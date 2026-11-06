import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { setFlash } from '#lib/server/flash.ts';
import { startUserSession } from '#lib/server/sessions.ts';
import {
	consumeAuthToken,
	passwordProblem,
	peekAuthToken,
	setPassword
} from '#lib/server/users.ts';
import { text } from '#lib/server/validation.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const user = peekAuthToken(getDb(), params.token, 'reset');
	return { valid: !!user, email: user?.email ?? null };
};

export const actions: Actions = {
	default: async (event) => {
		const data = await event.request.formData();
		const password = text(data, 'password', 300);
		const problem = passwordProblem(password, text(data, 'confirm', 300));
		if (problem) return fail(400, { error: problem });
		const db = getDb();
		const user = consumeAuthToken(db, event.params.token, 'reset');
		if (!user) return fail(400, { error: 'This link has expired. Request a new one.' });
		await setPassword(db, user.id, password);
		startUserSession(db, event.cookies, event.url, user.id);
		setFlash(event, 'success', 'Password updated. You’re signed in.');
		redirect(303, '/admin');
	}
};
