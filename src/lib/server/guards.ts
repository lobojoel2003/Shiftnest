import { error } from '@sveltejs/kit';
import type { SessionUser } from '../types';

/**
 * Decode a request path the way the router does, so `/%61dmin` is seen as `/admin`.
 * Returns null when the path can't be decoded.
 */
export function routedPath(pathname: string): string | null {
	try {
		return decodeURI(pathname).replace(/\/{2,}/g, '/');
	} catch {
		return null;
	}
}

/**
 * Whether a request is for the coordinator area. Decided by the matched route
 * first (exactly what SvelteKit will run), then by the decoded path. Paths that
 * can't be decoded are treated as admin requests, so the check fails closed.
 */
export function isAdminRequest(routeId: string | null, pathname: string): boolean {
	if (routeId === '/admin' || routeId?.startsWith('/admin/')) return true;
	const path = routedPath(pathname);
	return path === null || /^\/admin(\/|$)/i.test(path);
}

/** Use in admin endpoints and actions as a second line of defense. */
export function requireCoordinator(locals: App.Locals): SessionUser {
	if (!locals.user) error(401, 'Please sign in.');
	return locals.user;
}
