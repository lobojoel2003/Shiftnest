import { redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { endSession, USER_COOKIE } from '#lib/server/sessions.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ cookies, url }) => {
	endSession(getDb(), cookies, url, USER_COOKIE);
	redirect(303, '/login');
};
