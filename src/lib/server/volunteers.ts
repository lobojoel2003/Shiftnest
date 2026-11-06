import { randomToken } from './crypto';
import { ACTIVE_STATUSES, type DB } from './db';
import { completedHoursSql } from './hours';

export interface VolunteerRow {
	id: number;
	name: string;
	email: string;
	phone: string;
	sms_opt_in: number;
	manage_token: string;
	calendar_token: string;
	notes: string;
	created_at: number;
	updated_at: number;
}

export interface VolunteerListItem extends VolunteerRow {
	upcoming: number;
	completed: number;
	no_shows: number;
	hours: number;
	last_shift_at: number | null;
}

export function getVolunteer(db: DB, id: number): VolunteerRow | undefined {
	return db.prepare('SELECT * FROM volunteers WHERE id = ?').get(id) as VolunteerRow | undefined;
}

export function getVolunteerByEmail(db: DB, email: string): VolunteerRow | undefined {
	return db.prepare('SELECT * FROM volunteers WHERE email = ?').get(email.trim()) as
		VolunteerRow | undefined;
}

export function getVolunteerByManageToken(db: DB, token: string): VolunteerRow | undefined {
	if (!token) return undefined;
	return db.prepare('SELECT * FROM volunteers WHERE manage_token = ?').get(token) as
		VolunteerRow | undefined;
}

export function getVolunteerByCalendarToken(db: DB, token: string): VolunteerRow | undefined {
	if (!token) return undefined;
	return db.prepare('SELECT * FROM volunteers WHERE calendar_token = ?').get(token) as
		VolunteerRow | undefined;
}

export function createVolunteer(
	db: DB,
	input: { name: string; email: string; phone?: string; smsOptIn?: boolean },
	now = Date.now()
): VolunteerRow {
	const info = db
		.prepare(
			`INSERT INTO volunteers (name, email, phone, sms_opt_in, manage_token, calendar_token, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			input.name.trim(),
			input.email.trim(),
			input.phone ?? '',
			input.smsOptIn && input.phone ? 1 : 0,
			randomToken(24),
			randomToken(24),
			now,
			now
		);
	return getVolunteer(db, Number(info.lastInsertRowid))!;
}

/**
 * Find a volunteer by email, creating them if new.
 * Existing records are not modified: someone typing another person's email
 * must not be able to change that person's name or phone number.
 */
export function findOrCreateVolunteer(
	db: DB,
	input: { name: string; email: string; phone?: string; smsOptIn?: boolean },
	now = Date.now()
): { volunteer: VolunteerRow; created: boolean } {
	const existing = getVolunteerByEmail(db, input.email);
	if (existing) return { volunteer: existing, created: false };
	return { volunteer: createVolunteer(db, input, now), created: true };
}

export function updateVolunteer(
	db: DB,
	id: number,
	patch: { name?: string; email?: string; phone?: string; smsOptIn?: boolean; notes?: string },
	now = Date.now()
): void {
	const v = getVolunteer(db, id);
	if (!v) return;
	const phone = patch.phone ?? v.phone;
	const smsOptIn = patch.smsOptIn ?? v.sms_opt_in === 1;
	db.prepare(
		`UPDATE volunteers SET name = ?, email = ?, phone = ?, sms_opt_in = ?, notes = ?, updated_at = ?
		 WHERE id = ?`
	).run(
		patch.name?.trim() ?? v.name,
		patch.email?.trim() ?? v.email,
		phone,
		smsOptIn && phone ? 1 : 0,
		patch.notes ?? v.notes,
		now,
		id
	);
}

/** Issue new personal links, invalidating old ones (and signing out every device). */
export function rotateVolunteerTokens(db: DB, id: number): void {
	db.prepare('UPDATE volunteers SET manage_token = ?, calendar_token = ? WHERE id = ?').run(
		randomToken(24),
		randomToken(24),
		id
	);
	db.prepare('DELETE FROM sessions WHERE volunteer_id = ?').run(id);
}

export function deleteVolunteer(db: DB, id: number): void {
	db.prepare('DELETE FROM volunteers WHERE id = ?').run(id);
}

function likePattern(query: string): string {
	return `%${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function listVolunteers(
	db: DB,
	opts: {
		search?: string;
		assumeAttendance: boolean;
		now?: number;
		limit?: number;
		offset?: number;
	}
): { items: VolunteerListItem[]; total: number } {
	const search = opts.search?.trim() ?? '';
	const where = search
		? `WHERE (v.name LIKE @q ESCAPE '\\' OR v.email LIKE @q ESCAPE '\\' OR v.phone LIKE @q ESCAPE '\\')`
		: '';
	const filter = search ? { q: likePattern(search) } : {};
	const total = (
		db.prepare(`SELECT COUNT(*) AS n FROM volunteers v ${where}`).get(filter) as { n: number }
	).n;
	const items = db
		.prepare(
			`SELECT v.*,
				COALESCE(SUM(CASE WHEN su.status = 'confirmed' AND sh.starts_at > @now THEN 1 ELSE 0 END), 0) AS upcoming,
				COALESCE(SUM(CASE WHEN ${completedHoursSql('su', 'sh')} > 0 THEN 1 ELSE 0 END), 0) AS completed,
				COALESCE(SUM(CASE WHEN su.status = 'no_show' THEN 1 ELSE 0 END), 0) AS no_shows,
				COALESCE(SUM(${completedHoursSql('su', 'sh')}), 0) AS hours,
				MAX(CASE WHEN su.status IN ${ACTIVE_STATUSES} THEN sh.starts_at END) AS last_shift_at
			 FROM volunteers v
			 LEFT JOIN signups su ON su.volunteer_id = v.id
			 LEFT JOIN shifts sh ON sh.id = su.shift_id
			 ${where}
			 GROUP BY v.id
			 ORDER BY v.name COLLATE NOCASE
			 LIMIT @limit OFFSET @offset`
		)
		.all({
			...filter,
			now: opts.now ?? Date.now(),
			assume: opts.assumeAttendance ? 1 : 0,
			limit: opts.limit ?? 50,
			offset: opts.offset ?? 0
		}) as VolunteerListItem[];
	return { items, total };
}

export function countVolunteers(db: DB): number {
	return (db.prepare('SELECT COUNT(*) AS n FROM volunteers').get() as { n: number }).n;
}

/** Simple lookup for the "add a volunteer to this shift" picker. */
export function searchVolunteers(db: DB, query: string, limit = 8): VolunteerRow[] {
	const q = likePattern(query);
	return db
		.prepare(
			`SELECT * FROM volunteers WHERE name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'
			 ORDER BY name COLLATE NOCASE LIMIT ?`
		)
		.all(q, q, limit) as VolunteerRow[];
}
