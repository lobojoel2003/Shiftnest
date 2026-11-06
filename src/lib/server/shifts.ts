import type { EventStatus } from '../types';
import { ACTIVE_STATUSES, type DB } from './db';
import { AppError } from './validation';

export interface ShiftRow {
	id: number;
	event_id: number;
	role: string;
	starts_at: number;
	ends_at: number;
	capacity: number;
	location: string;
	notes: string;
	created_at: number;
	updated_at: number;
}

export interface ShiftWithStats extends ShiftRow {
	filled: number;
	cover_needed: number;
}

export interface ShiftDetail extends ShiftWithStats {
	event_slug: string;
	event_title: string;
	event_status: EventStatus;
	event_location: string;
}

export interface ShiftInput {
	role: string;
	startsAt: number;
	endsAt: number;
	capacity: number;
	location?: string;
	notes?: string;
}

const STATS = `
	(SELECT COUNT(*) FROM signups su WHERE su.shift_id = sh.id AND su.status IN ${ACTIVE_STATUSES}) AS filled,
	(SELECT COUNT(*) FROM signups su WHERE su.shift_id = sh.id AND su.status = 'confirmed'
		AND su.swap_token IS NOT NULL) AS cover_needed`;

function validate(input: ShiftInput): void {
	if (!input.role.trim()) throw new AppError('invalid', 'Give the shift a name, like “Sorting”.');
	if (!(input.endsAt > input.startsAt)) {
		throw new AppError('invalid', 'The shift has to end after it starts.');
	}
	if (input.endsAt - input.startsAt > 24 * 3_600_000) {
		throw new AppError('invalid', 'Shifts can be at most 24 hours long.');
	}
	if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 500) {
		throw new AppError('invalid', 'Spots must be a whole number between 1 and 500.');
	}
}

export function getShift(db: DB, id: number): ShiftDetail | undefined {
	return db
		.prepare(
			`SELECT sh.*, ${STATS}, e.slug AS event_slug, e.title AS event_title,
				e.status AS event_status, e.location AS event_location
			 FROM shifts sh JOIN events e ON e.id = sh.event_id
			 WHERE sh.id = ?`
		)
		.get(id) as ShiftDetail | undefined;
}

export function listShiftsForEvent(
	db: DB,
	eventId: number,
	opts: { from?: number } = {}
): ShiftWithStats[] {
	return db
		.prepare(
			`SELECT sh.*, ${STATS}
			 FROM shifts sh
			 WHERE sh.event_id = ? AND sh.ends_at > ?
			 ORDER BY sh.starts_at, sh.role COLLATE NOCASE`
		)
		.all(eventId, opts.from ?? 0) as ShiftWithStats[];
}

export type ShiftDetails = Omit<ShiftInput, 'startsAt' | 'endsAt'>;
export type ShiftTimes = { startsAt: number; endsAt: number };

/**
 * Create one shift per entry in `times` with the same details.
 * Callers compute the times (see `repeatTimes`) so repeats keep their
 * wall-clock time across daylight-saving changes.
 */
export function createShifts(
	db: DB,
	eventId: number,
	details: ShiftDetails,
	times: ShiftTimes[],
	now = Date.now()
): number[] {
	if (times.length === 0 || times.length > 52) {
		throw new AppError('invalid', 'You can create between 1 and 52 shifts at a time.');
	}
	for (const t of times) validate({ ...details, ...t });
	const insert = db.prepare(
		`INSERT INTO shifts (event_id, role, starts_at, ends_at, capacity, location, notes, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	);
	return db.transaction(() =>
		times.map((t) =>
			Number(
				insert.run(
					eventId,
					details.role.trim(),
					t.startsAt,
					t.endsAt,
					details.capacity,
					details.location?.trim() ?? '',
					details.notes?.trim() ?? '',
					now,
					now
				).lastInsertRowid
			)
		)
	)();
}

export function createShift(db: DB, eventId: number, input: ShiftInput, now = Date.now()): number {
	const { startsAt, endsAt, ...details } = input;
	return createShifts(db, eventId, details, [{ startsAt, endsAt }], now)[0];
}

/** Update a shift. Returns whether the time changed so callers can tell volunteers. */
export function updateShift(
	db: DB,
	id: number,
	input: ShiftInput,
	now = Date.now()
): { timeChanged: boolean; locationChanged: boolean } {
	validate(input);
	const current = getShift(db, id);
	if (!current) throw new AppError('not_found', 'That shift no longer exists.');
	const timeChanged = current.starts_at !== input.startsAt || current.ends_at !== input.endsAt;
	const locationChanged = (input.location?.trim() ?? '') !== current.location;
	db.transaction(() => {
		db.prepare(
			`UPDATE shifts SET role = ?, starts_at = ?, ends_at = ?, capacity = ?, location = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		).run(
			input.role.trim(),
			input.startsAt,
			input.endsAt,
			input.capacity,
			input.location?.trim() ?? '',
			input.notes?.trim() ?? '',
			now,
			id
		);
		if (timeChanged) {
			// Reminders are relative to the start time, so let them fire again.
			db.prepare(
				'DELETE FROM reminders_sent WHERE signup_id IN (SELECT id FROM signups WHERE shift_id = ?)'
			).run(id);
		}
	})();
	return { timeChanged, locationChanged };
}

export function deleteShift(db: DB, id: number): void {
	db.prepare('DELETE FROM shifts WHERE id = ?').run(id);
}

export interface UpcomingShift extends ShiftDetail {
	open: number;
}

/** Upcoming shifts across published events, optionally only those with open spots. */
export function upcomingShifts(
	db: DB,
	opts: { now?: number; until?: number; onlyOpen?: boolean; limit?: number } = {}
): UpcomingShift[] {
	const now = opts.now ?? Date.now();
	return db
		.prepare(
			`SELECT * FROM (
				SELECT sh.*, ${STATS}, e.slug AS event_slug, e.title AS event_title,
					e.status AS event_status, e.location AS event_location
				FROM shifts sh JOIN events e ON e.id = sh.event_id
				WHERE e.status = 'published' AND sh.starts_at > @now AND sh.starts_at < @until
			)
			${opts.onlyOpen ? 'WHERE filled < capacity OR cover_needed > 0' : ''}
			ORDER BY starts_at
			LIMIT @limit`
		)
		.all({ now, until: opts.until ?? now + 365 * 86_400_000, limit: opts.limit ?? 50 })
		.map((row) => {
			const r = row as ShiftDetail;
			return { ...r, open: Math.max(0, r.capacity - r.filled) };
		});
}
