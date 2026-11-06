import { redirect } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { getDb } from '#lib/server/db/index.ts';
import { openSwaps } from '#lib/server/signups.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	// The hook already guards /admin; this keeps types honest.
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);
	const db = getDb();
	const failed = (
		db.prepare(`SELECT COUNT(*) AS n FROM outbox WHERE status = 'failed'`).get() as { n: number }
	).n;
	return {
		user: locals.user,
		badges: {
			cover: openSwaps(db).length,
			failedMessages: failed
		},
		integrations: {
			email: config().smtp !== null,
			sms: config().twilio !== null
		}
	};
};
