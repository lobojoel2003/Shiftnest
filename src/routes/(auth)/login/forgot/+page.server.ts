import { fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { sendPasswordReset } from '#lib/server/notifications.ts';
import { rateLimit } from '#lib/server/rate-limit.ts';
import { createAuthToken, getUserByEmail } from '#lib/server/users.ts';
import { isEmail, text } from '#lib/server/validation.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const email = text(await request.formData(), 'email', 254).toLowerCase();
		if (!isEmail(email)) return fail(400, { email, error: 'Please enter a valid email address.' });
		const allowed =
			rateLimit(`reset-ip:${getClientAddress()}`, 10, 15 * 60_000) &&
			rateLimit(`reset-email:${email}`, 3, 15 * 60_000);
		if (!allowed)
			return fail(429, { email, error: 'Please wait a few minutes before trying again.' });
		const db = getDb();
		const user = getUserByEmail(db, email);
		if (user) sendPasswordReset(db, user, createAuthToken(db, user.id, 'reset', 3_600_000));
		return { sent: true, email };
	}
};
