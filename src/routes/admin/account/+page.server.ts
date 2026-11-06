import { fail } from '@sveltejs/kit';
import { verifyPassword } from '#lib/server/crypto.ts';
import { getDb } from '#lib/server/db/index.ts';
import { redirectWithFlash } from '#lib/server/flash.ts';
import { startUserSession } from '#lib/server/sessions.ts';
import {
	getUser,
	getUserByEmail,
	passwordProblem,
	setPassword,
	updateUser
} from '#lib/server/users.ts';
import { checkbox, isEmail, text } from '#lib/server/validation.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	const u = getUser(getDb(), locals.user!.id)!;
	return { account: { name: u.name, email: u.email, notify: u.notify === 1 } };
};

export const actions: Actions = {
	profile: async (event) => {
		const db = getDb();
		const me = event.locals.user!;
		const data = await event.request.formData();
		const name = text(data, 'name', 100);
		const email = text(data, 'email', 254).toLowerCase();
		const errors: Record<string, string> = {};
		if (!name) errors.name = 'Enter your name.';
		if (!isEmail(email)) errors.email = 'Enter a valid email.';
		else {
			const clash = getUserByEmail(db, email);
			if (clash && clash.id !== me.id) errors.email = 'Another coordinator uses this email.';
		}
		if (Object.keys(errors).length) return fail(400, { profileErrors: errors });
		updateUser(db, me.id, { name, email, notify: checkbox(data, 'notify') });
		redirectWithFlash(event, '/admin/account', 'success', 'Saved.');
	},

	password: async (event) => {
		const db = getDb();
		const me = getUser(db, event.locals.user!.id)!;
		const data = await event.request.formData();
		const current = text(data, 'current', 300);
		const next = text(data, 'password', 300);
		if (!(await verifyPassword(current, me.password_hash))) {
			return fail(400, { passwordError: 'Your current password isn’t right.' });
		}
		const problem = passwordProblem(next, text(data, 'confirm', 300));
		if (problem) return fail(400, { passwordError: problem });
		await setPassword(db, me.id, next);
		// setPassword signs out every session, including this one; start a fresh one.
		startUserSession(db, event.cookies, event.url, me.id);
		redirectWithFlash(
			event,
			'/admin/account',
			'success',
			'Password changed. Other devices were signed out.'
		);
	}
};
