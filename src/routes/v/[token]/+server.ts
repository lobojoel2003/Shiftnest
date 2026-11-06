import { redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { redirectWithFlash } from '#lib/server/flash.ts';
import { startVolunteerSession } from '#lib/server/sessions.ts';
import { getVolunteerByManageToken } from '#lib/server/volunteers.ts';
import type { RequestHandler } from './$types';

/** Personal link from emails: signs the volunteer in on this device. */
export const GET: RequestHandler = (event) => {
	const db = getDb();
	const volunteer = getVolunteerByManageToken(db, event.params.token);
	if (!volunteer) {
		redirectWithFlash(
			event,
			'/my',
			'error',
			'That link doesn’t work anymore. Enter your email and we’ll send you a fresh one.'
		);
	}
	startVolunteerSession(db, event.cookies, event.url, volunteer.id);
	redirect(303, '/my');
};
