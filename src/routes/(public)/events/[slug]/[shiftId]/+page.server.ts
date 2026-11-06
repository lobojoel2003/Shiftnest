import { error, fail, redirect } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { getDb } from '#lib/server/db/index.ts';
import { redirectWithFlash } from '#lib/server/flash.ts';
import { notifySignupConfirmed, sendPortalLink } from '#lib/server/notifications.ts';
import { isSpam, readPerson, resolveVolunteer } from '#lib/server/people.ts';
import { rateLimit } from '#lib/server/rate-limit.ts';
import { getSettings } from '#lib/server/settings.ts';
import { getShift } from '#lib/server/shifts.ts';
import { getSignupDetail, signUp, volunteerSignupsByShift } from '#lib/server/signups.ts';
import { AppError, maskEmail } from '#lib/server/validation.ts';
import { getVolunteer } from '#lib/server/volunteers.ts';
import type { Actions, PageServerLoad } from './$types';

function loadShift(slug: string, shiftId: string) {
	const shift = getShift(getDb(), Number(shiftId));
	if (!shift || shift.event_slug !== slug || shift.event_status !== 'published') {
		error(404, 'Shift not found');
	}
	return shift;
}

export const load: PageServerLoad = ({ params, locals }) => {
	const db = getDb();
	const shift = loadShift(params.slug, params.shiftId);
	const settings = getSettings(db);
	const volunteer = locals.volunteer ? getVolunteer(db, locals.volunteer.id) : undefined;
	const already = volunteer
		? volunteerSignupsByShift(db, volunteer.id, shift.event_id).has(shift.id)
		: false;

	return {
		shift: {
			id: shift.id,
			role: shift.role,
			startsAt: shift.starts_at,
			endsAt: shift.ends_at,
			capacity: shift.capacity,
			filled: shift.filled,
			location: shift.location || shift.event_location,
			notes: shift.notes,
			eventTitle: shift.event_title,
			eventSlug: shift.event_slug,
			started: shift.starts_at <= Date.now()
		},
		already,
		smsAvailable: config().twilio !== null,
		cancelCutoffHours: settings.cancelCutoffHours,
		reminderHours: settings.reminderHours,
		me: volunteer
			? {
					name: volunteer.name,
					email: volunteer.email,
					phone: volunteer.phone,
					sms: volunteer.sms_opt_in === 1
				}
			: null
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { request, params, getClientAddress } = event;
		const db = getDb();
		const shift = loadShift(params.slug, params.shiftId);
		const data = await request.formData();
		const settings = getSettings(db);

		if (isSpam(data)) redirect(303, `/events/${shift.event_slug}`);
		if (!rateLimit(`signup:${getClientAddress()}`, 30, 10 * 60_000)) {
			return fail(429, {
				error: 'Too many sign-ups from this device. Please wait a few minutes.',
				code: 'rate_limited'
			});
		}

		const { values, errors, phone } = readPerson(data, settings);
		if (Object.keys(errors).length) return fail(400, { values, errors });

		const { volunteer, signedIn } = resolveVolunteer(db, event, values, phone);

		const notSignedInMessage = `You’re signed up! We emailed ${maskEmail(volunteer.email)} a confirmation with a link to manage your shifts.`;
		let signupId: number;
		try {
			signupId = signUp(db, { shiftId: shift.id, volunteerId: volunteer.id, note: values.note });
		} catch (err) {
			if (err instanceof AppError) {
				// Don't confirm to an anonymous visitor that this email is already on the shift.
				// Answer as if it worked and send the email's owner their personal link.
				if (err.code === 'duplicate' && !signedIn) {
					sendPortalLink(db, volunteer, settings);
					redirectWithFlash(event, `/events/${shift.event_slug}`, 'success', notSignedInMessage);
				}
				return fail(409, { values, error: err.message, code: err.code });
			}
			throw err;
		}
		const detail = getSignupDetail(db, signupId)!;
		notifySignupConfirmed(db, detail, settings);

		if (signedIn) {
			redirectWithFlash(
				event,
				'/my',
				'success',
				`You’re signed up for ${shift.role}! A confirmation is on its way to ${volunteer.email}.`
			);
		}
		redirectWithFlash(event, `/events/${shift.event_slug}`, 'success', notSignedInMessage);
	}
};
