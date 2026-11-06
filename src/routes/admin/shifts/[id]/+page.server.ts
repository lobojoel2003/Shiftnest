import { error, fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { redirectWithFlash } from '#lib/server/flash.ts';
import { readShiftForm } from '#lib/server/forms.ts';
import {
	notifyRemovedByCoordinator,
	notifyShiftChanged,
	notifyShiftDeleted,
	notifySignupConfirmed
} from '#lib/server/notifications.ts';
import { getSettings } from '#lib/server/settings.ts';
import { deleteShift, getShift, updateShift } from '#lib/server/shifts.ts';
import {
	activeSignupsForShift,
	cancelSignup,
	getSignupDetail,
	rosterForShift,
	setAttendance,
	signUp
} from '#lib/server/signups.ts';
import {
	AppError,
	checkbox,
	int,
	isEmail,
	normalizePhone,
	num,
	text
} from '#lib/server/validation.ts';
import { findOrCreateVolunteer } from '#lib/server/volunteers.ts';
import { utcToZoned } from '#lib/time.ts';
import type { SignupStatus } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';
import { requireCoordinator } from '#lib/server/guards.ts';

function loadShift(id: string) {
	const shift = getShift(getDb(), Number(id));
	if (!shift) error(404, 'Shift not found');
	return shift;
}

export const load: PageServerLoad = ({ params, locals }) => {
	requireCoordinator(locals);
	const db = getDb();
	const shift = loadShift(params.id);
	const tz = getSettings(db).timezone;
	const now = Date.now();
	const start = utcToZoned(shift.starts_at, tz);
	const end = utcToZoned(shift.ends_at, tz);
	const roster = rosterForShift(db, shift.id);
	const defaultHours = (shift.ends_at - shift.starts_at) / 3_600_000;

	return {
		now,
		shift: {
			id: shift.id,
			role: shift.role,
			startsAt: shift.starts_at,
			endsAt: shift.ends_at,
			capacity: shift.capacity,
			filled: shift.filled,
			location: shift.location,
			notes: shift.notes,
			eventId: shift.event_id,
			eventTitle: shift.event_title,
			eventSlug: shift.event_slug,
			eventLocation: shift.event_location,
			started: shift.starts_at <= now,
			ended: shift.ends_at <= now,
			defaultHours
		},
		values: {
			role: shift.role,
			date: start.date,
			start: start.time,
			end: end.time,
			capacity: shift.capacity,
			location: shift.location,
			notes: shift.notes
		},
		roster: roster
			.filter((s) => s.status !== 'cancelled')
			.map((s) => ({
				id: s.id,
				volunteerId: s.volunteer_id,
				name: s.volunteer_name,
				email: s.volunteer_email,
				phone: s.volunteer_phone,
				status: s.status,
				hours: s.hours,
				note: s.note,
				createdAt: s.created_at,
				checkedInAt: s.checked_in_at,
				needsCover: !!s.swap_token,
				coverUrl: s.swap_token ? `/swap/${s.swap_token}` : null
			})),
		cancelled: roster
			.filter((s) => s.status === 'cancelled')
			.map((s) => ({
				id: s.id,
				volunteerId: s.volunteer_id,
				name: s.volunteer_name,
				reason: s.cancel_reason,
				at: s.cancelled_at
			}))
	};
};

export const actions: Actions = {
	attendance: async (event) => {
		requireCoordinator(event.locals);
		const shift = loadShift(event.params.id);
		const data = await event.request.formData();
		const status = text(data, 'status', 20) as Exclude<SignupStatus, 'cancelled'>;
		if (!['confirmed', 'attended', 'no_show'].includes(status)) return fail(400);
		const rawHours = text(data, 'hours', 10);
		const hours = rawHours === '' ? null : num(data, 'hours');
		try {
			setAttendance(getDb(), { signupId: int(data, 'signupId') ?? 0, status, hours });
		} catch (err) {
			if (err instanceof AppError) return fail(400, { error: err.message });
			throw err;
		}
		return { saved: int(data, 'signupId'), shiftId: shift.id };
	},

	markAllAttended: async (event) => {
		requireCoordinator(event.locals);
		const db = getDb();
		const shift = loadShift(event.params.id);
		let n = 0;
		for (const s of activeSignupsForShift(db, shift.id)) {
			if (s.status === 'confirmed') {
				setAttendance(db, { signupId: s.id, status: 'attended' });
				n++;
			}
		}
		redirectWithFlash(
			event,
			`/admin/shifts/${shift.id}`,
			'success',
			`Marked ${n} volunteer${n === 1 ? '' : 's'} as attended.`
		);
	},

	remove: async (event) => {
		requireCoordinator(event.locals);
		const db = getDb();
		const shift = loadShift(event.params.id);
		const data = await event.request.formData();
		try {
			const s = cancelSignup(db, { signupId: int(data, 'signupId') ?? 0, asCoordinator: true });
			if (shift.starts_at > Date.now()) notifyRemovedByCoordinator(db, s);
			redirectWithFlash(
				event,
				`/admin/shifts/${shift.id}`,
				'success',
				`${s.volunteer_name} was removed from this shift.`
			);
		} catch (err) {
			if (err instanceof AppError) return fail(400, { error: err.message });
			throw err;
		}
	},

	add: async (event) => {
		requireCoordinator(event.locals);
		const db = getDb();
		const shift = loadShift(event.params.id);
		const settings = getSettings(db);
		const data = await event.request.formData();
		const add = {
			name: text(data, 'name', 100),
			email: text(data, 'email', 254).toLowerCase(),
			phone: text(data, 'phone', 40),
			notify: checkbox(data, 'notify')
		};
		const errors: Record<string, string> = {};
		if (!add.name) errors.name = 'Enter a name.';
		if (!isEmail(add.email)) errors.email = 'Enter a valid email.';
		const phone = normalizePhone(add.phone, settings.phoneCountryCode);
		if (phone === null) errors.phone = 'Check the phone number.';
		if (Object.keys(errors).length) return fail(400, { add, addErrors: errors });

		const { volunteer } = findOrCreateVolunteer(db, {
			name: add.name,
			email: add.email,
			phone: phone ?? ''
		});
		try {
			const id = signUp(db, { shiftId: shift.id, volunteerId: volunteer.id, asCoordinator: true });
			if (add.notify && shift.starts_at > Date.now())
				notifySignupConfirmed(db, getSignupDetail(db, id)!, settings);
		} catch (err) {
			if (err instanceof AppError)
				return fail(409, {
					add,
					addErrors: { email: err.message.replace('You’re', 'They’re') } as Record<string, string>
				});
			throw err;
		}
		redirectWithFlash(
			event,
			`/admin/shifts/${shift.id}`,
			'success',
			`${volunteer.name} added to the shift.`
		);
	},

	update: async (event) => {
		requireCoordinator(event.locals);
		const db = getDb();
		const shift = loadShift(event.params.id);
		const settings = getSettings(db);
		const data = await event.request.formData();
		data.set('repeat', 'none');
		const parsed = readShiftForm(data, settings.timezone);
		if (!parsed.details || !parsed.times) {
			return fail(400, { edit: { values: parsed.values, errors: parsed.errors } });
		}
		try {
			const changes = updateShift(db, shift.id, { ...parsed.details, ...parsed.times[0] });
			const notify = checkbox(data, 'notify') && parsed.times[0].startsAt > Date.now();
			if (notify && (changes.timeChanged || changes.locationChanged)) {
				notifyShiftChanged(
					db,
					activeSignupsForShift(db, shift.id).filter((s) => s.status === 'confirmed'),
					changes,
					settings
				);
			}
		} catch (err) {
			if (err instanceof AppError) {
				return fail(400, { edit: { values: parsed.values, errors: { role: err.message } } });
			}
			throw err;
		}
		redirectWithFlash(event, `/admin/shifts/${shift.id}`, 'success', 'Shift updated.');
	},

	delete: async (event) => {
		requireCoordinator(event.locals);
		const db = getDb();
		const shift = loadShift(event.params.id);
		const affected =
			shift.starts_at > Date.now()
				? activeSignupsForShift(db, shift.id).filter((s) => s.status === 'confirmed')
				: [];
		notifyShiftDeleted(db, affected);
		deleteShift(db, shift.id);
		redirectWithFlash(
			event,
			`/admin/events/${shift.event_id}`,
			'success',
			affected.length
				? `Shift deleted and ${affected.length} volunteer${affected.length === 1 ? '' : 's'} notified.`
				: 'Shift deleted.'
		);
	}
};
