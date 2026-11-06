import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { rateLimit } from '#lib/server/rate-limit.ts';
import { startUserSession } from '#lib/server/sessions.ts';
import { authenticate } from '#lib/server/users.ts';
import { safeRedirectPath, text } from '#lib/server/validation.ts';
import type { Actions, PageServerLoad } from './$types';

function nextPath(url: URL): string {
	const next = safeRedirectPath(url.searchParams.get('next'), '/admin');
	return next.startsWith('/admin') ? next : '/admin';
}

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, nextPath(url));
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const data = await request.formData();
		const email = text(data, 'email', 254).toLowerCase();
		const password = text(data, 'password', 300);
		const allowed =
			rateLimit(`login-ip:${getClientAddress()}`, 20, 15 * 60_000) &&
			rateLimit(`login-email:${email}`, 8, 15 * 60_000);
		if (!allowed) {
			return fail(429, {
				email,
				error: 'Too many attempts. Please wait 15 minutes and try again.'
			});
		}
		const db = getDb();
		const user = await authenticate(db, email, password);
		if (!user) return fail(400, { email, error: 'That email and password don’t match.' });
		startUserSession(db, cookies, url, user.id);
		redirect(303, nextPath(url));
	}
};
