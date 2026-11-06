import { describe, expect, it } from 'vitest';
import { createShift, getShift } from './shifts';
import {
	cancelSignup,
	checkIn,
	getSignupDetail,
	getSwap,
	moveSignup,
	openSwaps,
	requestSwap,
	setAttendance,
	signUp,
	signupsForVolunteer,
	takeSwap,
	withdrawSwap
} from './signups';
import { DAY, fixture, HOUR, NOW, testDb } from './testing';

function codeOf(fn: () => unknown): string | undefined {
	try {
		fn();
	} catch (err) {
		return (err as { code?: string }).code;
	}
	return undefined;
}

describe('signUp', () => {
	it('confirms a sign-up and counts it against capacity', () => {
		const db = testDb();
		const { shiftId, volunteer } = fixture(db, { capacity: 2 });
		const id = signUp(db, { shiftId, volunteerId: volunteer('Ana').id, now: NOW });
		expect(getSignupDetail(db, id)?.status).toBe('confirmed');
		expect(getShift(db, shiftId)?.filled).toBe(1);
	});

	it('refuses when the shift is full, but coordinators can overbook', () => {
		const db = testDb();
		const { shiftId, volunteer } = fixture(db, { capacity: 1 });
		signUp(db, { shiftId, volunteerId: volunteer('Ana').id, now: NOW });
		const ben = volunteer('Ben');
		expect(codeOf(() => signUp(db, { shiftId, volunteerId: ben.id, now: NOW }))).toBe('full');
		signUp(db, { shiftId, volunteerId: ben.id, now: NOW, asCoordinator: true });
		expect(getShift(db, shiftId)?.filled).toBe(2);
	});

	it('prevents duplicates, past shifts and unpublished events', () => {
		const db = testDb();
		const { shiftId, startsAt, volunteer } = fixture(db);
		const ana = volunteer('Ana');
		signUp(db, { shiftId, volunteerId: ana.id, now: NOW });
		expect(codeOf(() => signUp(db, { shiftId, volunteerId: ana.id, now: NOW }))).toBe('duplicate');
		expect(
			codeOf(() => signUp(db, { shiftId, volunteerId: volunteer('Ben').id, now: startsAt }))
		).toBe('started');

		const draft = fixture(db, { status: 'draft' });
		expect(
			codeOf(() => signUp(db, { shiftId: draft.shiftId, volunteerId: ana.id, now: NOW }))
		).toBe('closed');
	});

	it('lets someone sign up again after cancelling', () => {
		const db = testDb();
		const { shiftId, volunteer } = fixture(db);
		const ana = volunteer('Ana');
		const first = signUp(db, { shiftId, volunteerId: ana.id, now: NOW });
		cancelSignup(db, { signupId: first, volunteerId: ana.id, now: NOW });
		const second = signUp(db, { shiftId, volunteerId: ana.id, now: NOW });
		expect(second).not.toBe(first);
		expect(signupsForVolunteer(db, ana.id)).toHaveLength(1);
	});
});

describe('cancelSignup', () => {
	it('honours the cancellation cutoff for volunteers only', () => {
		const db = testDb();
		const { shiftId, volunteer } = fixture(db, { startsIn: 10 * HOUR });
		const ana = volunteer('Ana');
		const id = signUp(db, { shiftId, volunteerId: ana.id, now: NOW });
		expect(
			codeOf(() =>
				cancelSignup(db, { signupId: id, volunteerId: ana.id, cutoffHours: 24, now: NOW })
			)
		).toBe('cutoff');
		const removed = cancelSignup(db, { signupId: id, asCoordinator: true, now: NOW });
		expect(removed.volunteer_name).toBe('Ana');
		expect(getSignupDetail(db, id)?.cancel_reason).toBe('coordinator');
	});

	it('does not let one volunteer cancel another volunteer’s sign-up', () => {
		const db = testDb();
		const { shiftId, volunteer } = fixture(db);
		const id = signUp(db, { shiftId, volunteerId: volunteer('Ana').id, now: NOW });
		const ben = volunteer('Ben');
		expect(codeOf(() => cancelSignup(db, { signupId: id, volunteerId: ben.id, now: NOW }))).toBe(
			'not_found'
		);
	});
});

describe('moveSignup', () => {
	it('switches to another shift in the same event atomically', () => {
		const db = testDb();
		const { event, shiftId, startsAt, volunteer } = fixture(db);
		const later = createShift(
			db,
			event.id,
			{ role: 'Sorting', startsAt: startsAt + DAY, endsAt: startsAt + DAY + 2 * HOUR, capacity: 1 },
			NOW
		);
		const ana = volunteer('Ana');
		const id = signUp(db, { shiftId, volunteerId: ana.id, note: 'Bringing a friend', now: NOW });
		const moved = moveSignup(db, {
			signupId: id,
			volunteerId: ana.id,
			toShiftId: later,
			cutoffHours: 24,
			now: NOW
		});
		expect(getSignupDetail(db, id)?.cancel_reason).toBe('moved');
		expect(getSignupDetail(db, moved)?.shift_id).toBe(later);
		expect(getSignupDetail(db, moved)?.note).toBe('Bringing a friend');
	});

	it('rolls back if the target shift is full', () => {
		const db = testDb();
		const { event, shiftId, startsAt, volunteer } = fixture(db);
		const later = createShift(
			db,
			event.id,
			{ role: 'Sorting', startsAt: startsAt + DAY, endsAt: startsAt + DAY + 2 * HOUR, capacity: 1 },
			NOW
		);
		signUp(db, { shiftId: later, volunteerId: volunteer('Ben').id, now: NOW });
		const ana = volunteer('Ana');
		const id = signUp(db, { shiftId, volunteerId: ana.id, now: NOW });
		expect(
			codeOf(() =>
				moveSignup(db, {
					signupId: id,
					volunteerId: ana.id,
					toShiftId: later,
					cutoffHours: 0,
					now: NOW
				})
			)
		).toBe('full');
		expect(getSignupDetail(db, id)?.status).toBe('confirmed');
	});

	it('refuses shifts from a different event', () => {
		const db = testDb();
		const a = fixture(db);
		const b = fixture(db);
		const ana = a.volunteer('Ana');
		const id = signUp(db, { shiftId: a.shiftId, volunteerId: ana.id, now: NOW });
		expect(
			codeOf(() =>
				moveSignup(db, {
					signupId: id,
					volunteerId: ana.id,
					toShiftId: b.shiftId,
					cutoffHours: 0,
					now: NOW
				})
			)
		).toBe('not_found');
	});
});

describe('swaps', () => {
	it('hands a shift to someone else without freeing the spot', () => {
		const db = testDb();
		const { shiftId, volunteer } = fixture(db, { capacity: 1 });
		const ana = volunteer('Ana');
		const ben = volunteer('Ben');
		const id = signUp(db, { shiftId, volunteerId: ana.id, now: NOW });
		const token = requestSwap(db, { signupId: id, volunteerId: ana.id, now: NOW });
		expect(requestSwap(db, { signupId: id, volunteerId: ana.id, now: NOW })).toBe(token);
		expect(getSwap(db, token)?.volunteer_name).toBe('Ana');
		expect(openSwaps(db, { now: NOW })).toHaveLength(1);
		expect(getShift(db, shiftId)?.cover_needed).toBe(1);

		const { newSignupId, original } = takeSwap(db, { token, volunteerId: ben.id, now: NOW });
		expect(original.volunteer_name).toBe('Ana');
		expect(getSignupDetail(db, id)?.cancel_reason).toBe('swapped');
		expect(getSignupDetail(db, newSignupId)?.volunteer_name).toBe('Ben');
		expect(getShift(db, shiftId)?.filled).toBe(1);
		expect(getSwap(db, token)).toBeUndefined();
	});

	it('rejects taking your own shift, a shift you are already on, or a withdrawn request', () => {
		const db = testDb();
		const { shiftId, volunteer } = fixture(db, { capacity: 3 });
		const ana = volunteer('Ana');
		const ben = volunteer('Ben');
		const id = signUp(db, { shiftId, volunteerId: ana.id, now: NOW });
		signUp(db, { shiftId, volunteerId: ben.id, now: NOW });
		const token = requestSwap(db, { signupId: id, volunteerId: ana.id, now: NOW });
		expect(codeOf(() => takeSwap(db, { token, volunteerId: ana.id, now: NOW }))).toBe('own');
		expect(codeOf(() => takeSwap(db, { token, volunteerId: ben.id, now: NOW }))).toBe('duplicate');
		withdrawSwap(db, { signupId: id, volunteerId: ana.id, now: NOW });
		expect(codeOf(() => takeSwap(db, { token, volunteerId: volunteer('Cy').id, now: NOW }))).toBe(
			'not_found'
		);
	});
});

describe('attendance', () => {
	it('allows self check-in only around the shift', () => {
		const db = testDb();
		const { shiftId, startsAt, volunteer } = fixture(db);
		const ana = volunteer('Ana');
		const id = signUp(db, { shiftId, volunteerId: ana.id, now: NOW });
		expect(codeOf(() => checkIn(db, { signupId: id, volunteerId: ana.id, now: NOW }))).toBe(
			'not_open'
		);
		checkIn(db, { signupId: id, volunteerId: ana.id, now: startsAt - 30 * 60_000 });
		expect(getSignupDetail(db, id)?.status).toBe('attended');
	});

	it('lets coordinators mark no-shows and override hours', () => {
		const db = testDb();
		const { shiftId, volunteer } = fixture(db);
		const id = signUp(db, { shiftId, volunteerId: volunteer('Ana').id, now: NOW });
		setAttendance(db, { signupId: id, status: 'attended', hours: 1.5, now: NOW });
		expect(getSignupDetail(db, id)?.hours).toBe(1.5);
		setAttendance(db, { signupId: id, status: 'no_show', hours: null, now: NOW });
		expect(getSignupDetail(db, id)?.status).toBe('no_show');
		expect(
			codeOf(() => setAttendance(db, { signupId: id, status: 'attended', hours: 30, now: NOW }))
		).toBe('invalid');
	});
});
