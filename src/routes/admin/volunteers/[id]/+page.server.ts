import { error, fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { redirectWithFlash } from '#lib/server/flash.ts';
import { volunteerTotalHours } from '#lib/server/hours.ts';
import { sendPortalLink } from '#lib/server/notifications.ts';
import { getSettings } from '#lib/server/settings.ts';
import { signupsForVolunteer } from '#lib/server/signups.ts';
import { checkbox, isEmail, longText, normalizePhone, text } from '#lib/server/validation.ts';
import {
	deleteVolunteer,
	getVolunteer,
	getVolunteerByEmail,
	rotateVolunteerTokens,
	updateVolunteer
} from '#lib/server/volunteers.ts';
import type { Actions, PageServerLoad } from './$types';
import { requireCoordinator } from '#lib/server/guards.ts';

function loadVolunteer(id: string) {
	const v = getVolunteer(getDb(), Number(id));
	if (!v) error(404, 'Volunteer not found');
	return v;
}

export const load: PageServerLoad = ({ params, locals }) => {
	requireCoordinator(locals);
	const db = getDb();
	const v = loadVolunteer(params.id);
	const settings = getSettings(db);
	const now = Date.now();
	return {
		now,
		volunteer: {
			id: v.id,
			name: v.name,
			email: v.email,
			phone: v.phone,
			sms: v.sms_opt_in === 1,
			notes: v.notes,
			createdAt: v.created_at
		},
		totals: volunteerTotalHours(db, v.id, settings.assumeAttendance, now),
		signups: signupsForVolunteer(db, v.id)
			.reverse()
			.map((s) => ({
				id: s.id,
				shiftId: s.shift_id,
				role: s.role,
				eventTitle: s.event_title,
				startsAt: s.starts_at,
				endsAt: s.ends_at,
				status: s.status,
				hours: s.hours,
				needsCover: !!s.swap_token,
				upcoming: s.starts_at > now
			}))
	};
};

export const actions: Actions = {
	update: async (event) => {
		requireCoordinator(event.locals);
		const db = getDb();
		const v = loadVolunteer(event.params.id);
		const data = await event.request.formData();
		const values = {
			name: text(data, 'name', 100),
			email: text(data, 'email', 254).toLowerCase(),
			phone: text(data, 'phone', 40),
			sms: checkbox(data, 'sms'),
			notes: longText(data, 'notes', 2000)
		};
		const errors: Record<string, string> = {};
		if (!values.name) errors.name = 'Enter a name.';
		if (!isEmail(values.email)) errors.email = 'Enter a valid email.';
		else {
			const clash = getVolunteerByEmail(db, values.email);
			if (clash && clash.id !== v.id) errors.email = 'Another volunteer already uses this email.';
		}
		const phone = normalizePhone(values.phone, getSettings(db).phoneCountryCode);
		if (phone === null) errors.phone = 'Check the phone number.';
		if (Object.keys(errors).length) return fail(400, { values, errors });
		updateVolunteer(db, v.id, { ...values, phone: phone ?? '', smsOptIn: values.sms });
		redirectWithFlash(event, `/admin/volunteers/${v.id}`, 'success', 'Saved.');
	},

	sendLink: async (event) => {
		requireCoordinator(event.locals);
		const db = getDb();
		const v = loadVolunteer(event.params.id);
		sendPortalLink(db, v);
		redirectWithFlash(
			event,
			`/admin/volunteers/${v.id}`,
			'success',
			`Sent ${v.name} a link to their shifts.`
		);
	},

	rotate: async (event) => {
		requireCoordinator(event.locals);
		const v = loadVolunteer(event.params.id);
		rotateVolunteerTokens(getDb(), v.id);
		redirectWithFlash(
			event,
			`/admin/volunteers/${v.id}`,
			'success',
			'Old links disabled. They can request a new one from “Find my shifts”.'
		);
	},

	delete: async (event) => {
		requireCoordinator(event.locals);
		const v = loadVolunteer(event.params.id);
		deleteVolunteer(getDb(), v.id);
		redirectWithFlash(
			event,
			'/admin/volunteers',
			'success',
			`${v.name} and their history were deleted.`
		);
	}
};
