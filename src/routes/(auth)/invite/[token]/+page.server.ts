import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { setFlash } from '#lib/server/flash.ts';
import { startUserSession } from '#lib/server/sessions.ts';
import {
	consumeAuthToken,
	passwordProblem,
	peekAuthToken,
	setPassword,
	updateUser
} from '#lib/server/users.ts';
import { text } from '#lib/server/validation.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const user = peekAuthToken(getDb(), params.token, 'invite');
	return { valid: !!user, email: user?.email ?? null, name: user?.name ?? '' };
};

export const actions: Actions = {
	default: async (event) => {
		const data = await event.request.formData();
		const name = text(data, 'name', 100);
		const password = text(data, 'password', 300);
		const problem = !name
			? 'Please enter your name.'
			: passwordProblem(password, text(data, 'confirm', 300));
		if (problem) return fail(400, { error: problem });
		const db = getDb();
		const user = consumeAuthToken(db, event.params.token, 'invite');
		if (!user) return fail(400, { error: 'This invitation has expired. Ask for a new one.' });
		updateUser(db, user.id, { name });
		await setPassword(db, user.id, password);
		startUserSession(db, event.cookies, event.url, user.id);
		setFlash(event, 'success', `Welcome aboard, ${name.split(' ')[0]}!`);
		redirect(303, '/admin');
	}
};
