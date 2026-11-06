import { fail, redirect, type Cookies } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { getDb } from '#lib/server/db/index.ts';
import { redirectWithFlash } from '#lib/server/flash.ts';
import { volunteerTotalHours } from '#lib/server/hours.ts';
import { googleCalendarUrl } from '#lib/server/ical.ts';
import {
	notifyCancelled,
	notifyCoverRequested,
	sendPortalLink
} from '#lib/server/notifications.ts';
import { rateLimit } from '#lib/server/rate-limit.ts';
import { endSession, startVolunteerSession, VOLUNTEER_COOKIE } from '#lib/server/sessions.ts';
import { getSettings } from '#lib/server/settings.ts';
import {
	canCheckIn,
	cancelSignup,
	checkIn,
	getSignupDetail,
	requestSwap,
	signupsForVolunteer,
	withdrawSwap,
	withinCutoff
} from '#lib/server/signups.ts';
import {
	AppError,
	checkbox,
	int,
	isEmail,
	normalizeEmail,
	normalizePhone,
	safeRedirectPath,
	text
} from '#lib/server/validation.ts';
import {
	getVolunteer,
	getVolunteerByEmail,
	rotateVolunteerTokens,
	updateVolunteer
} from '#lib/server/volunteers.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.volunteer) return { signedIn: false as const };

	const db = getDb();
	const v = getVolunteer(db, locals.volunteer.id)!;
	const settings = getSettings(db);
	const now = Date.now();
	const all = signupsForVolunteer(db, v.id);
	const totals = volunteerTotalHours(db, v.id, settings.assumeAttendance, now);

	const upcoming = all
		.filter((s) => s.ends_at > now)
		.map((s) => {
			const confirmed = s.status === 'confirmed';
			const notStarted = s.starts_at > now;
			const locked = withinCutoff(s.starts_at, now, settings.cancelCutoffHours);
			return {
				id: s.id,
				shiftId: s.shift_id,
				role: s.role,
				startsAt: s.starts_at,
				endsAt: s.ends_at,
				location: s.shift_location || s.event_location,
				notes: s.shift_notes,
				eventTitle: s.event_title,
				eventSlug: s.event_slug,
				status: s.status,
				coverUrl: s.swap_token ? `${url.origin}/swap/${s.swap_token}` : null,
				canChange: confirmed && notStarted && !locked,
				lockedByCutoff: confirmed && notStarted && locked,
				canCover: confirmed && notStarted,
				canCheckIn:
					settings.allowSelfCheckin && confirmed && canCheckIn(s.starts_at, s.ends_at, now),
				googleUrl: googleCalendarUrl({
					title: `${s.role} · ${s.event_title}`,
					start: s.starts_at,
					end: s.ends_at,
					location: s.shift_location || s.event_location,
					details: `${settings.orgName}\n${url.origin}/my`
				})
			};
		});

	const past = all
		.filter((s) => s.ends_at <= now)
		.reverse()
		.slice(0, 30)
		.map((s) => ({
			id: s.id,
			role: s.role,
			startsAt: s.starts_at,
			endsAt: s.ends_at,
			eventTitle: s.event_title,
			status: s.status,
			hours:
				s.status === 'attended' || (s.status === 'confirmed' && settings.assumeAttendance)
					? (s.hours ?? (s.ends_at - s.starts_at) / 3_600_000)
					: 0
		}));

	return {
		signedIn: true as const,
		now,
		me: {
			name: v.name,
			email: v.email,
			phone: v.phone,
			sms: v.sms_opt_in === 1
		},
		upcoming,
		past,
		totals,
		smsAvailable: config().twilio !== null,
		cancelCutoffHours: settings.cancelCutoffHours,
		calendarUrl: `${url.origin}/ical/v/${v.calendar_token}.ics`
	};
};

function requireVolunteer(locals: App.Locals) {
	if (!locals.volunteer) redirect(303, '/my');
	return locals.volunteer;
}

/** Run a volunteer action, turning rule violations into a friendly flash message. */
function attempt(event: { cookies: Cookies; url: URL }, fn: () => string): never {
	let message: string;
	try {
		message = fn();
	} catch (err) {
		if (err instanceof AppError) redirectWithFlash(event, '/my', 'error', err.message);
		throw err;
	}
	redirectWithFlash(event, '/my', 'success', message);
}

export const actions: Actions = {
	sendLink: async ({ request, getClientAddress }) => {
		const data = await request.formData();
		const email = normalizeEmail(text(data, 'email', 254));
		if (!isEmail(email)) return fail(400, { email, error: 'Please enter a valid email address.' });
		const ok =
			rateLimit(`link-ip:${getClientAddress()}`, 10, 15 * 60_000) &&
			rateLimit(`link-email:${email}`, 3, 15 * 60_000);
		if (!ok) return fail(429, { email, error: 'Please wait a few minutes before trying again.' });

		const db = getDb();
		const volunteer = getVolunteerByEmail(db, email);
		if (volunteer) sendPortalLink(db, volunteer);
		// Same answer either way, so this can't be used to discover who volunteers here.
		return { sent: true, email };
	},

	cancel: async (event) => {
		const volunteer = requireVolunteer(event.locals);
		const signupId = int(await event.request.formData(), 'signupId') ?? 0;
		const db = getDb();
		const settings = getSettings(db);
		attempt(event, () => {
			const s = cancelSignup(db, {
				signupId,
				volunteerId: volunteer.id,
				cutoffHours: settings.cancelCutoffHours
			});
			notifyCancelled(db, s, settings);
			return `You’re off ${s.role}. Thanks for letting us know!`;
		});
	},

	cover: async (event) => {
		const volunteer = requireVolunteer(event.locals);
		const signupId = int(await event.request.formData(), 'signupId') ?? 0;
		const db = getDb();
		attempt(event, () => {
			const token = requestSwap(db, { signupId, volunteerId: volunteer.id });
			const s = getSignupDetail(db, signupId)!;
			notifyCoverRequested(db, s, token);
			return 'Your shift is now listed as needing cover. You stay on it until someone takes it. Share the link below to find someone faster.';
		});
	},

	withdrawCover: async (event) => {
		const volunteer = requireVolunteer(event.locals);
		const signupId = int(await event.request.formData(), 'signupId') ?? 0;
		attempt(event, () => {
			withdrawSwap(getDb(), { signupId, volunteerId: volunteer.id });
			return 'Cover request withdrawn. You’re still on the shift.';
		});
	},

	checkin: async (event) => {
		const volunteer = requireVolunteer(event.locals);
		const signupId = int(await event.request.formData(), 'signupId') ?? 0;
		const db = getDb();
		if (!getSettings(db).allowSelfCheckin) redirect(303, '/my');
		attempt(event, () => {
			checkIn(db, { signupId, volunteerId: volunteer.id });
			return 'You’re checked in. Thank you for being here!';
		});
	},

	profile: async (event) => {
		const volunteer = requireVolunteer(event.locals);
		const data = await event.request.formData();
		const db = getDb();
		const settings = getSettings(db);
		const name = text(data, 'name', 100);
		const phone = normalizePhone(text(data, 'phone', 40), settings.phoneCountryCode);
		const sms = checkbox(data, 'sms');
		const errors: Record<string, string> = {};
		if (!name) errors.name = 'Please enter your name.';
		if (phone === null) errors.phone = 'That doesn’t look like a phone number.';
		else if (sms && !phone) errors.phone = 'Add a mobile number to get text reminders.';
		if (Object.keys(errors).length) {
			return fail(400, { profile: { name, phone: text(data, 'phone', 40), sms }, errors });
		}
		updateVolunteer(db, volunteer.id, { name, phone: phone ?? '', smsOptIn: sms });
		redirectWithFlash(event, '/my', 'success', 'Your details are saved.');
	},

	resetLinks: async (event) => {
		const volunteer = requireVolunteer(event.locals);
		const db = getDb();
		rotateVolunteerTokens(db, volunteer.id);
		startVolunteerSession(db, event.cookies, event.url, volunteer.id);
		sendPortalLink(db, getVolunteer(db, volunteer.id)!);
		redirectWithFlash(
			event,
			'/my',
			'success',
			'Done. Your old links no longer work, and we emailed you a new one. Re-subscribe your calendar with the new feed address.'
		);
	},

	signout: async (event) => {
		const data = await event.request.formData();
		endSession(getDb(), event.cookies, VOLUNTEER_COOKIE);
		redirect(303, safeRedirectPath(text(data, 'next', 300), '/'));
	}
};
