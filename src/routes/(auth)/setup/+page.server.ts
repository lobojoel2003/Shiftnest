import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { setFlash } from '#lib/server/flash.ts';
import { startUserSession } from '#lib/server/sessions.ts';
import { updateSettings } from '#lib/server/settings.ts';
import { countUsers, createFirstOwner, passwordProblem } from '#lib/server/users.ts';
import { isEmail, text } from '#lib/server/validation.ts';
import { isValidTimeZone, timeZones } from '#lib/time.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (countUsers(getDb()) > 0) redirect(303, '/login');
	return { zones: timeZones() };
};

export const actions: Actions = {
	default: async (event) => {
		const db = getDb();
		if (countUsers(db) > 0) redirect(303, '/login');
		const data = await event.request.formData();
		const values = {
			orgName: text(data, 'orgName', 100),
			name: text(data, 'name', 100),
			email: text(data, 'email', 254).toLowerCase(),
			timezone: text(data, 'timezone', 64)
		};
		const password = text(data, 'password', 300);
		const errors: Record<string, string> = {};
		if (!values.orgName) errors.orgName = 'What’s your group called?';
		if (!values.name) errors.name = 'Please enter your name.';
		if (!isEmail(values.email)) errors.email = 'Please enter a valid email address.';
		if (!isValidTimeZone(values.timezone)) errors.timezone = 'Pick your time zone.';
		const pw = passwordProblem(password);
		if (pw) errors.password = pw;
		if (Object.keys(errors).length) return fail(400, { values, errors });

		const user = await createFirstOwner(db, { ...values, password });
		if (!user) redirect(303, '/login');
		updateSettings(db, {
			orgName: values.orgName,
			timezone: values.timezone,
			contactEmail: values.email
		});
		startUserSession(db, event.cookies, event.url, user.id);
		setFlash(event, 'success', 'Welcome to Shiftnest! Start by creating your first event.');
		redirect(303, '/admin');
	}
};
