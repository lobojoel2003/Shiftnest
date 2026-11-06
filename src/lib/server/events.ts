import type { EventStatus } from '../types';
import { ACTIVE_STATUSES, type DB } from './db';
import { slugify } from './validation';

export interface EventRow {
	id: number;
	slug: string;
	title: string;
	summary: string;
	description: string;
	location: string;
	status: EventStatus;
	created_at: number;
	updated_at: number;
}

export interface EventListItem extends EventRow {
	shift_count: number;
	upcoming_shifts: number;
	capacity: number;
	filled: number;
	next_start: number | null;
	last_end: number | null;
}

export interface EventInput {
	title: string;
	summary?: string;
	description?: string;
	location?: string;
	status?: EventStatus;
	slug?: string;
}

export function getEvent(db: DB, id: number): EventRow | undefined {
	return db.prepare('SELECT * FROM events WHERE id = ?').get(id) as EventRow | undefined;
}

export function getEventBySlug(db: DB, slug: string): EventRow | undefined {
	return db.prepare('SELECT * FROM events WHERE slug = ?').get(slug) as EventRow | undefined;
}

function uniqueSlug(db: DB, base: string, exceptId?: number): string {
	const root = slugify(base);
	let candidate = root;
	for (let i = 2; ; i++) {
		const clash = db.prepare('SELECT id FROM events WHERE slug = ?').get(candidate) as
			{ id: number } | undefined;
		if (!clash || clash.id === exceptId) return candidate;
		candidate = `${root}-${i}`;
	}
}

export function createEvent(db: DB, input: EventInput, now = Date.now()): EventRow {
	const slug = uniqueSlug(db, input.slug || input.title);
	const info = db
		.prepare(
			`INSERT INTO events (slug, title, summary, description, location, status, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			slug,
			input.title.trim(),
			input.summary?.trim() ?? '',
			input.description?.trim() ?? '',
			input.location?.trim() ?? '',
			input.status ?? 'draft',
			now,
			now
		);
	return getEvent(db, Number(info.lastInsertRowid))!;
}

export function updateEvent(db: DB, id: number, input: EventInput, now = Date.now()): EventRow {
	const current = getEvent(db, id);
	if (!current) throw new Error('Event not found');
	const slug = input.slug ? uniqueSlug(db, input.slug, id) : current.slug;
	db.prepare(
		`UPDATE events SET slug = ?, title = ?, summary = ?, description = ?, location = ?, status = ?, updated_at = ?
		 WHERE id = ?`
	).run(
		slug,
		input.title.trim(),
		input.summary?.trim() ?? current.summary,
		input.description?.trim() ?? current.description,
		input.location?.trim() ?? current.location,
		input.status ?? current.status,
		now,
		id
	);
	return getEvent(db, id)!;
}

export function setEventStatus(db: DB, id: number, status: EventStatus, now = Date.now()): void {
	db.prepare('UPDATE events SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
}

export function deleteEvent(db: DB, id: number): void {
	db.prepare('DELETE FROM events WHERE id = ?').run(id);
}

const LIST_SQL = `
	SELECT e.*,
		COUNT(sh.id) AS shift_count,
		COALESCE(SUM(CASE WHEN sh.starts_at > @now THEN 1 ELSE 0 END), 0) AS upcoming_shifts,
		COALESCE(SUM(CASE WHEN sh.starts_at > @now THEN sh.capacity ELSE 0 END), 0) AS capacity,
		COALESCE(SUM(CASE WHEN sh.starts_at > @now THEN
			(SELECT COUNT(*) FROM signups su WHERE su.shift_id = sh.id AND su.status IN ${ACTIVE_STATUSES})
		ELSE 0 END), 0) AS filled,
		MIN(CASE WHEN sh.starts_at > @now THEN sh.starts_at END) AS next_start,
		MAX(sh.ends_at) AS last_end
	FROM events e
	LEFT JOIN shifts sh ON sh.event_id = e.id`;

/** Events for the admin list, with upcoming fill stats. */
export function listEvents(
	db: DB,
	opts: { status?: EventStatus | 'all'; now?: number } = {}
): EventListItem[] {
	const status = opts.status ?? 'all';
	return db
		.prepare(
			`${LIST_SQL}
			 ${status === 'all' ? '' : 'WHERE e.status = @status'}
			 GROUP BY e.id
			 ORDER BY CASE e.status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
				next_start IS NULL, next_start, e.updated_at DESC`
		)
		.all(
			status === 'all' ? { now: opts.now ?? Date.now() } : { now: opts.now ?? Date.now(), status }
		) as EventListItem[];
}

/** Published events that still have upcoming shifts, soonest first. */
export function listPublicEvents(db: DB, now = Date.now()): EventListItem[] {
	return db
		.prepare(
			`${LIST_SQL}
			 WHERE e.status = 'published'
			 GROUP BY e.id
			 HAVING upcoming_shifts > 0
			 ORDER BY next_start`
		)
		.all({ now }) as EventListItem[];
}
