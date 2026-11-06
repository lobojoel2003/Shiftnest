import { json } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { BUILD } from '#lib/version.ts';
import type { RequestHandler } from './$types';

/** Liveness/readiness probe for Docker, Kubernetes and uptime monitors. */
export const GET: RequestHandler = () => {
	let database = 'ok';
	try {
		getDb().prepare('SELECT 1').get();
	} catch {
		database = 'error';
	}
	const ok = database === 'ok';
	return json(
		{
			status: ok ? 'ok' : 'error',
			version: BUILD.version,
			build: BUILD.buildNumber,
			commit: BUILD.commit,
			builtAt: BUILD.date,
			uptimeSeconds: Math.round(process.uptime()),
			database
		},
		{ status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } }
	);
};
