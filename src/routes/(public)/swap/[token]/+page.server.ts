import { fail, redirect } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { getDb } from '#lib/server/db/index.ts';
import { redirectWithFlash } from '#lib/server/flash.ts';
import { notifyCoverTaken } from '#lib/server/notifications.ts';
import { isSpam, readPerson, resolveVolunteer } from '#lib/server/people.ts';
import { rateLimit } from '#lib/server/rate-limit.ts';
import { getSettings } from '#lib/server/settings.ts';
import { getSignupDetail, getSwap, takeSwap } from '#lib/server/signups.ts';
import { AppError, maskEmail } from '#lib/server/validation.ts';
import { getVolunteer } from '#lib/server/volunteers.ts';
import type { Actions, PageServerLoad } from './$types';

/** Show only a first name and initial to people opening a shared link. */
function shortName(name: string): string {
	const parts = name.trim().split(/\s+/);
	return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : parts[0];
}

export const load: PageServerLoad = ({ params, locals, url }) => {
	const db = getDb();
	const swap = getSwap(db, params.token);
	if (!swap || swap.starts_at <= Date.now()) return { available: false as const };
	const volunteer = locals.volunteer ? getVolunteer(db, locals.volunteer.id) : undefined;
	return {
		available: true as const,
		own: volunteer?.id === swap.volunteer_id,
		shareUrl: url.href,
		requester: shortName(swap.volunteer_name),
		shift: {
			role: swap.role,
			startsAt: swap.starts_at,
			endsAt: swap.ends_at,
			location: swap.shift_location || swap.event_location,
			notes: swap.shift_notes,
			eventTitle: swap.event_title,
			eventSlug: swap.event_slug
		},
		smsAvailable: config().twilio !== null,
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
		const data = await request.formData();
		if (isSpam(data)) redirect(303, '/');
		if (!rateLimit(`swap:${getClientAddress()}`, 20, 10 * 60_000)) {
			return fail(429, { error: 'Too many attempts from this device. Please wait a few minutes.' });
		}
		const settings = getSettings(db);
		const { values, errors, phone } = readPerson(data, settings);
		if (Object.keys(errors).length) return fail(400, { values, errors });

		const { volunteer, signedIn } = resolveVolunteer(db, event, values, phone);
		let result: ReturnType<typeof takeSwap>;
		try {
			result = takeSwap(db, { token: params.token, volunteerId: volunteer.id });
		} catch (err) {
			if (err instanceof AppError) return fail(409, { values, error: err.message });
			throw err;
		}
		const taken = getSignupDetail(db, result.newSignupId)!;
		notifyCoverTaken(db, result.original, taken, settings);

		const message = `Thank you! You’re now on ${taken.role}, and we’ve let ${shortName(result.original.volunteer_name)} know.`;
		if (signedIn) redirectWithFlash(event, '/my', 'success', message);
		redirectWithFlash(
			event,
			`/events/${taken.event_slug}`,
			'success',
			`${message} Details are in your inbox at ${maskEmail(volunteer.email)}.`
		);
	}
};
