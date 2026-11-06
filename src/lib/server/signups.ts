import type { CancelReason, EventStatus, SignupStatus } from '../types';
import { randomToken } from './crypto';
import { ACTIVE_STATUSES, type DB } from './db';
import { AppError } from './validation';

const HOUR = 3_600_000;

/** Self check-in opens this long before a shift starts… */
export const CHECKIN_OPENS_BEFORE = HOUR;
/** …and stays open this long after it ends. */
export const CHECKIN_CLOSES_AFTER = 12 * HOUR;

export interface SignupRow {
	id: number;
	shift_id: number;
	volunteer_id: number;
	status: SignupStatus;
	note: string;
	hours: number | null;
	swap_token: string | null;
	swap_requested_at: number | null;
	checked_in_at: number | null;
	cancel_reason: CancelReason | null;
	cancelled_at: number | null;
	created_at: number;
	updated_at: number;
}

export interface SignupDetail extends SignupRow {
	role: string;
	starts_at: number;
	ends_at: number;
	capacity: number;
	shift_location: string;
	shift_notes: string;
	event_id: number;
	event_slug: string;
	event_title: string;
	event_location: string;
	event_status: EventStatus;
	volunteer_name: string;
	volunteer_email: string;
	volunteer_phone: string;
	volunteer_sms_opt_in: number;
	volunteer_manage_token: string;
}

const DETAIL_SQL = `
	SELECT su.*, sh.role, sh.starts_at, sh.ends_at, sh.capacity,
		sh.location AS shift_location, sh.notes AS shift_notes,
		e.id AS event_id, e.slug AS event_slug, e.title AS event_title,
		e.location AS event_location, e.status AS event_status,
		v.name AS volunteer_name, v.email AS volunteer_email, v.phone AS volunteer_phone,
		v.sms_opt_in AS volunteer_sms_opt_in, v.manage_token AS volunteer_manage_token
	FROM signups su
	JOIN shifts sh ON sh.id = su.shift_id
	JOIN events e ON e.id = sh.event_id
	JOIN volunteers v ON v.id = su.volunteer_id`;

export function getSignupDetail(db: DB, id: number): SignupDetail | undefined {
	return db.prepare(`${DETAIL_SQL} WHERE su.id = ?`).get(id) as SignupDetail | undefined;
}

/** Whether a volunteer may still cancel or switch on their own. */
export function withinCutoff(startsAt: number, now: number, cutoffHours: number): boolean {
	return cutoffHours > 0 && startsAt - now < cutoffHours * HOUR;
}

export function canCheckIn(startsAt: number, endsAt: number, now: number): boolean {
	return now >= startsAt - CHECKIN_OPENS_BEFORE && now <= endsAt + CHECKIN_CLOSES_AFTER;
}

function filledCount(db: DB, shiftId: number): number {
	return (
		db
			.prepare(
				`SELECT COUNT(*) AS n FROM signups WHERE shift_id = ? AND status IN ${ACTIVE_STATUSES}`
			)
			.get(shiftId) as { n: number }
	).n;
}

function activeSignupFor(db: DB, shiftId: number, volunteerId: number): SignupRow | undefined {
	return db
		.prepare(
			`SELECT * FROM signups WHERE shift_id = ? AND volunteer_id = ? AND status IN ${ACTIVE_STATUSES}`
		)
		.get(shiftId, volunteerId) as SignupRow | undefined;
}

function insertSignup(
	db: DB,
	shiftId: number,
	volunteerId: number,
	note: string,
	now: number
): number {
	const info = db
		.prepare(
			`INSERT INTO signups (shift_id, volunteer_id, status, note, created_at, updated_at)
			 VALUES (?, ?, 'confirmed', ?, ?, ?)`
		)
		.run(shiftId, volunteerId, note.slice(0, 500), now, now);
	return Number(info.lastInsertRowid);
}

/** Load a sign-up that belongs to `volunteerId` and is still confirmed. */
function ownedConfirmed(db: DB, signupId: number, volunteerId: number): SignupDetail {
	const s = getSignupDetail(db, signupId);
	if (!s || s.volunteer_id !== volunteerId || s.status === 'cancelled') {
		throw new AppError('not_found', 'We couldn’t find that sign-up. It may have been cancelled.');
	}
	if (s.status !== 'confirmed') {
		throw new AppError('locked', 'This shift has already been marked by a coordinator.');
	}
	return s;
}

export interface SignUpInput {
	shiftId: number;
	volunteerId: number;
	note?: string;
	now?: number;
	/** Coordinators can add people to full, past or unpublished shifts. */
	asCoordinator?: boolean;
}

export function signUp(db: DB, input: SignUpInput): number {
	const now = input.now ?? Date.now();
	return db
		.transaction(() => {
			const shift = db
				.prepare(
					`SELECT sh.starts_at, sh.capacity, e.status AS event_status
				 FROM shifts sh JOIN events e ON e.id = sh.event_id WHERE sh.id = ?`
				)
				.get(input.shiftId) as
				{ starts_at: number; capacity: number; event_status: EventStatus } | undefined;
			if (!shift) throw new AppError('not_found', 'That shift no longer exists.');
			if (!input.asCoordinator) {
				if (shift.event_status !== 'published') {
					throw new AppError('closed', 'Sign-ups for this event are closed.');
				}
				if (shift.starts_at <= now) {
					throw new AppError('started', 'This shift has already started.');
				}
			}
			if (activeSignupFor(db, input.shiftId, input.volunteerId)) {
				throw new AppError('duplicate', 'You’re already signed up for this shift.');
			}
			if (!input.asCoordinator && filledCount(db, input.shiftId) >= shift.capacity) {
				throw new AppError('full', 'Sorry, this shift just filled up. Please pick another time.');
			}
			return insertSignup(db, input.shiftId, input.volunteerId, input.note ?? '', now);
		})
		.immediate();
}

export interface CancelInput {
	signupId: number;
	/** Required for volunteer cancellations; ignored for coordinators. */
	volunteerId?: number;
	asCoordinator?: boolean;
	cutoffHours?: number;
	reason?: CancelReason;
	now?: number;
}

export function cancelSignup(db: DB, input: CancelInput): SignupDetail {
	const now = input.now ?? Date.now();
	return db
		.transaction(() => {
			let s: SignupDetail;
			if (input.asCoordinator) {
				const found = getSignupDetail(db, input.signupId);
				if (!found || found.status === 'cancelled') {
					throw new AppError('not_found', 'That sign-up was already removed.');
				}
				s = found;
			} else {
				s = ownedConfirmed(db, input.signupId, input.volunteerId ?? -1);
				if (s.starts_at <= now) throw new AppError('started', 'This shift has already started.');
				if (withinCutoff(s.starts_at, now, input.cutoffHours ?? 0)) {
					throw new AppError(
						'cutoff',
						`It’s less than ${input.cutoffHours} hours until this shift, so it can’t be cancelled online. Ask for cover instead, or contact the coordinator.`
					);
				}
			}
			db.prepare(
				`UPDATE signups SET status = 'cancelled', cancel_reason = ?, cancelled_at = ?, updated_at = ?,
				swap_token = NULL, swap_requested_at = NULL
			 WHERE id = ?`
			).run(input.reason ?? (input.asCoordinator ? 'coordinator' : 'volunteer'), now, now, s.id);
			return s;
		})
		.immediate();
}

/** Switch a volunteer's sign-up to a different shift of the same event. */
export function moveSignup(
	db: DB,
	input: {
		signupId: number;
		volunteerId: number;
		toShiftId: number;
		cutoffHours: number;
		now?: number;
	}
): number {
	const now = input.now ?? Date.now();
	return db
		.transaction(() => {
			const s = ownedConfirmed(db, input.signupId, input.volunteerId);
			if (s.shift_id === input.toShiftId) {
				throw new AppError('same', 'You’re already on that shift.');
			}
			if (s.starts_at <= now) throw new AppError('started', 'This shift has already started.');
			if (withinCutoff(s.starts_at, now, input.cutoffHours)) {
				throw new AppError(
					'cutoff',
					`It’s less than ${input.cutoffHours} hours until this shift, so it can’t be switched online. Ask for cover instead.`
				);
			}
			const target = db.prepare('SELECT event_id FROM shifts WHERE id = ?').get(input.toShiftId) as
				{ event_id: number } | undefined;
			if (!target || target.event_id !== s.event_id) {
				throw new AppError('not_found', 'That shift isn’t part of this event.');
			}
			db.prepare(
				`UPDATE signups SET status = 'cancelled', cancel_reason = 'moved', cancelled_at = ?, updated_at = ?,
				swap_token = NULL, swap_requested_at = NULL
			 WHERE id = ?`
			).run(now, now, s.id);
			return signUp(db, {
				shiftId: input.toShiftId,
				volunteerId: input.volunteerId,
				note: s.note,
				now
			});
		})
		.immediate();
}

/** Mark a sign-up as needing cover. Returns the shareable swap token. */
export function requestSwap(
	db: DB,
	input: { signupId: number; volunteerId: number; now?: number }
): string {
	const now = input.now ?? Date.now();
	const s = ownedConfirmed(db, input.signupId, input.volunteerId);
	if (s.starts_at <= now) throw new AppError('started', 'This shift has already started.');
	if (s.swap_token) return s.swap_token;
	const token = randomToken(18);
	db.prepare(
		'UPDATE signups SET swap_token = ?, swap_requested_at = ?, updated_at = ? WHERE id = ?'
	).run(token, now, now, s.id);
	return token;
}

export function withdrawSwap(
	db: DB,
	input: { signupId: number; volunteerId: number; now?: number }
): void {
	const now = input.now ?? Date.now();
	const s = ownedConfirmed(db, input.signupId, input.volunteerId);
	db.prepare(
		'UPDATE signups SET swap_token = NULL, swap_requested_at = NULL, updated_at = ? WHERE id = ?'
	).run(now, s.id);
}

/** An open cover request, looked up by its share token. */
export function getSwap(db: DB, token: string): SignupDetail | undefined {
	if (!token) return undefined;
	return db
		.prepare(`${DETAIL_SQL} WHERE su.swap_token = ? AND su.status = 'confirmed'`)
		.get(token) as SignupDetail | undefined;
}

/**
 * Take over a shift someone asked to be covered. The original volunteer is
 * released and the taker is confirmed in one step, so the spot is never empty.
 */
export function takeSwap(
	db: DB,
	input: { token: string; volunteerId: number; now?: number }
): { newSignupId: number; original: SignupDetail } {
	const now = input.now ?? Date.now();
	return db
		.transaction(() => {
			const original = getSwap(db, input.token);
			if (!original) {
				throw new AppError(
					'not_found',
					'This shift no longer needs cover. Someone may have taken it already.'
				);
			}
			if (original.starts_at <= now)
				throw new AppError('started', 'This shift has already started.');
			if (original.volunteer_id === input.volunteerId) {
				throw new AppError('own', 'This is your own shift. Someone else needs to take it.');
			}
			if (activeSignupFor(db, original.shift_id, input.volunteerId)) {
				throw new AppError('duplicate', 'You’re already signed up for this shift.');
			}
			db.prepare(
				`UPDATE signups SET status = 'cancelled', cancel_reason = 'swapped', cancelled_at = ?, updated_at = ?,
				swap_token = NULL, swap_requested_at = NULL
			 WHERE id = ?`
			).run(now, now, original.id);
			const newSignupId = insertSignup(db, original.shift_id, input.volunteerId, '', now);
			return { newSignupId, original };
		})
		.immediate();
}

export function checkIn(
	db: DB,
	input: { signupId: number; volunteerId: number; now?: number }
): void {
	const now = input.now ?? Date.now();
	const s = getSignupDetail(db, input.signupId);
	if (!s || s.volunteer_id !== input.volunteerId || s.status === 'cancelled') {
		throw new AppError('not_found', 'We couldn’t find that sign-up.');
	}
	if (s.status === 'attended') return;
	if (s.status !== 'confirmed') {
		throw new AppError('locked', 'A coordinator has already marked this shift.');
	}
	if (!canCheckIn(s.starts_at, s.ends_at, now)) {
		throw new AppError('not_open', 'Check-in opens an hour before your shift starts.');
	}
	db.prepare(
		`UPDATE signups SET status = 'attended', checked_in_at = ?, updated_at = ?,
			swap_token = NULL, swap_requested_at = NULL
		 WHERE id = ?`
	).run(now, now, s.id);
}

/** Coordinator attendance marking. `hours` overrides the shift length when set. */
export function setAttendance(
	db: DB,
	input: {
		signupId: number;
		status: Exclude<SignupStatus, 'cancelled'>;
		hours?: number | null;
		now?: number;
	}
): void {
	const now = input.now ?? Date.now();
	if (input.hours != null && (!(input.hours >= 0) || input.hours > 24)) {
		throw new AppError('invalid', 'Hours must be between 0 and 24.');
	}
	const s = getSignupDetail(db, input.signupId);
	if (!s || s.status === 'cancelled') throw new AppError('not_found', 'That sign-up was removed.');
	db.prepare(
		`UPDATE signups SET status = ?, hours = ?, updated_at = ?,
			swap_token = CASE WHEN ? = 'confirmed' THEN swap_token ELSE NULL END,
			swap_requested_at = CASE WHEN ? = 'confirmed' THEN swap_requested_at ELSE NULL END
		 WHERE id = ?`
	).run(
		input.status,
		input.hours === undefined ? s.hours : input.hours,
		now,
		input.status,
		input.status,
		s.id
	);
}

// --- Queries ---------------------------------------------------------------------------

/** A volunteer's active sign-ups (upcoming and past), soonest first. */
export function signupsForVolunteer(db: DB, volunteerId: number): SignupDetail[] {
	return db
		.prepare(
			`${DETAIL_SQL} WHERE su.volunteer_id = ? AND su.status <> 'cancelled' ORDER BY sh.starts_at`
		)
		.all(volunteerId) as SignupDetail[];
}

/** Everyone on a shift, including cancellations (newest last). */
export function rosterForShift(db: DB, shiftId: number): SignupDetail[] {
	return db
		.prepare(
			`${DETAIL_SQL} WHERE su.shift_id = ?
			 ORDER BY su.status = 'cancelled', v.name COLLATE NOCASE, su.created_at`
		)
		.all(shiftId) as SignupDetail[];
}

export function activeSignupsForShift(db: DB, shiftId: number): SignupDetail[] {
	return db
		.prepare(`${DETAIL_SQL} WHERE su.shift_id = ? AND su.status IN ${ACTIVE_STATUSES}`)
		.all(shiftId) as SignupDetail[];
}

/** Upcoming confirmed sign-ups for an event (for messaging). */
export function upcomingSignupsForEvent(db: DB, eventId: number, now = Date.now()): SignupDetail[] {
	return db
		.prepare(
			`${DETAIL_SQL} WHERE e.id = ? AND su.status = 'confirmed' AND sh.starts_at > ?
			 ORDER BY sh.starts_at`
		)
		.all(eventId, now) as SignupDetail[];
}

/** Open cover requests for upcoming shifts. */
export function openSwaps(db: DB, opts: { now?: number; eventId?: number } = {}): SignupDetail[] {
	const now = opts.now ?? Date.now();
	return db
		.prepare(
			`${DETAIL_SQL} WHERE su.status = 'confirmed' AND su.swap_token IS NOT NULL AND sh.starts_at > ?
			 ${opts.eventId ? 'AND e.id = ?' : ''}
			 ORDER BY sh.starts_at`
		)
		.all(...(opts.eventId ? [now, opts.eventId] : [now])) as SignupDetail[];
}

export function recentSignups(db: DB, limit = 8): SignupDetail[] {
	return db
		.prepare(`${DETAIL_SQL} WHERE su.status <> 'cancelled' ORDER BY su.created_at DESC LIMIT ?`)
		.all(limit) as SignupDetail[];
}

/** Map of shift id → this volunteer's sign-up, for one event. */
export function volunteerSignupsByShift(
	db: DB,
	volunteerId: number,
	eventId: number
): Map<number, SignupRow> {
	const rows = db
		.prepare(
			`SELECT su.* FROM signups su JOIN shifts sh ON sh.id = su.shift_id
			 WHERE su.volunteer_id = ? AND sh.event_id = ? AND su.status IN ${ACTIVE_STATUSES}`
		)
		.all(volunteerId, eventId) as SignupRow[];
	return new Map(rows.map((r) => [r.shift_id, r]));
}
