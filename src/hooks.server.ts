import type { Handle, HandleServerError, ServerInit } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { config, learnOrigin } from '#lib/server/config.ts';
import { closeDb, getDb } from '#lib/server/db/index.ts';
import { seedDemo } from '#lib/server/demo.ts';
import {
	getUserSession,
	getVolunteerSession,
	USER_COOKIE,
	VOLUNTEER_COOKIE
} from '#lib/server/sessions.ts';
import { getSettings } from '#lib/server/settings.ts';
import { countUsers } from '#lib/server/users.ts';
import { startWorkers, stopWorkers } from '#lib/server/worker.ts';

export const init: ServerInit = async () => {
	if (building) return;
	const db = getDb();
	if (config().demo) await seedDemo(db);
	startWorkers(db);
	process.once('sveltekit:shutdown', () => {
		stopWorkers();
		closeDb();
	});
};

let setupComplete = false;

/** Paths that work before the first coordinator account exists. */
function allowedBeforeSetup(pathname: string): boolean {
	return pathname === '/setup' || pathname.startsWith('/api/') || /\.[a-z0-9]+$/i.test(pathname);
}

function redirectTo(location: string): Response {
	return new Response(null, { status: 303, headers: { location } });
}

export const handle: Handle = async ({ event, resolve }) => {
	const db = getDb();
	const { cookies, url } = event;
	learnOrigin(url.origin);

	event.locals.user = null;
	event.locals.volunteer = null;

	const userToken = cookies.get(USER_COOKIE);
	if (userToken) {
		event.locals.user = getUserSession(db, userToken);
		if (!event.locals.user) cookies.delete(USER_COOKIE, { path: '/' });
	}
	const volunteerToken = cookies.get(VOLUNTEER_COOKIE);
	if (volunteerToken) {
		event.locals.volunteer = getVolunteerSession(db, volunteerToken);
		if (!event.locals.volunteer) cookies.delete(VOLUNTEER_COOKIE, { path: '/' });
	}

	if (!setupComplete) {
		setupComplete = countUsers(db) > 0;
		if (!setupComplete && !allowedBeforeSetup(url.pathname)) return redirectTo('/setup');
	}

	const isAdmin = url.pathname === '/admin' || url.pathname.startsWith('/admin/');
	if (isAdmin && !event.locals.user) {
		if (event.request.method === 'GET' || event.request.method === 'HEAD') {
			return redirectTo(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
		}
		return new Response('Please sign in again.', { status: 401 });
	}

	const lang = getSettings(db).locale.split('-')[0] || 'en';
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('<html lang="en">', `<html lang="${lang}">`)
	});

	try {
		response.headers.set('x-content-type-options', 'nosniff');
		response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
		response.headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
		if (isAdmin || event.locals.volunteer || /^\/(my|v|swap)(\/|$)/.test(url.pathname)) {
			response.headers.set('cache-control', 'private, no-store');
		}
	} catch {
		// Some responses (e.g. redirects created by fetch) have immutable headers.
	}
	return response;
};

export const handleError: HandleServerError = ({ kind, error, event }) => {
	if (kind !== 'unknown') return;
	console.error(
		`[shiftnest] unhandled error on ${event.request.method} ${event.url.pathname}`,
		error
	);
	return { message: 'Something went wrong on our end. Please try again.' };
};
