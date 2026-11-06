import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { redirectWithFlash } from '#lib/server/flash.ts';
import { notifyMoved } from '#lib/server/notifications.ts';
import { getSettings } from '#lib/server/settings.ts';
import { listShiftsForEvent } from '#lib/server/shifts.ts';
import {
	getSignupDetail,
	moveSignup,
	volunteerSignupsByShift,
	withinCutoff
} from '#lib/server/signups.ts';
import { AppError, int } from '#lib/server/validation.ts';
import type { Actions, PageServerLoad } from './$types';

function ownSignup(locals: App.Locals, id: string) {
	if (!locals.volunteer) redirect(303, '/my');
	const s = getSignupDetail(getDb(), Number(id));
	if (!s || s.volunteer_id !== locals.volunteer.id || s.status !== 'confirmed') {
		error(404, 'Sign-up not found');
	}
	return { s, volunteer: locals.volunteer };
}

export const load: PageServerLoad = ({ locals, params }) => {
	const db = getDb();
	const { s, volunteer } = ownSignup(locals, params.id);
	const settings = getSettings(db);
	const now = Date.now();
	const mine = volunteerSignupsByShift(db, volunteer.id, s.event_id);
	const options = listShiftsForEvent(db, s.event_id, { from: now })
		.filter((o) => o.starts_at > now && !mine.has(o.id))
		.map((o) => ({
			id: o.id,
			role: o.role,
			startsAt: o.starts_at,
			endsAt: o.ends_at,
			open: Math.max(0, o.capacity - o.filled),
			sameRole: o.role === s.role
		}));

	return {
		current: {
			id: s.id,
			role: s.role,
			startsAt: s.starts_at,
			endsAt: s.ends_at,
			eventTitle: s.event_title
		},
		locked: withinCutoff(s.starts_at, now, settings.cancelCutoffHours),
		cutoffHours: settings.cancelCutoffHours,
		options
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { locals, params, request } = event;
		const db = getDb();
		const { s, volunteer } = ownSignup(locals, params.id);
		const toShiftId = int(await request.formData(), 'shiftId');
		if (!toShiftId) return fail(400, { error: 'Pick a shift to switch to.' });
		let newId: number;
		try {
			newId = moveSignup(db, {
				signupId: s.id,
				volunteerId: volunteer.id,
				toShiftId,
				cutoffHours: getSettings(db).cancelCutoffHours
			});
		} catch (err) {
			if (err instanceof AppError) return fail(409, { error: err.message });
			throw err;
		}
		const next = getSignupDetail(db, newId)!;
		notifyMoved(db, s, next);
		redirectWithFlash(event, '/my', 'success', `Switched! You’re now on ${next.role}.`);
	}
};
