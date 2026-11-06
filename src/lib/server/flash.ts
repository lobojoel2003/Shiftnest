import { redirect, type Cookies } from '@sveltejs/kit';
import type { Flash } from '../types';

const COOKIE = 'sn_flash';

type Ctx = { cookies: Cookies; url: URL };

/** Show a one-time message on the next page load. */
export function setFlash({ cookies, url }: Ctx, type: Flash['type'], message: string): void {
	cookies.set(COOKIE, JSON.stringify({ type, message } satisfies Flash), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 60
	});
}

export function readFlash(cookies: Cookies): Flash | null {
	const raw = cookies.get(COOKIE);
	if (!raw) return null;
	cookies.delete(COOKIE, { path: '/' });
	try {
		const parsed = JSON.parse(raw) as Flash;
		if (typeof parsed.message === 'string' && ['success', 'error', 'info'].includes(parsed.type)) {
			return parsed;
		}
	} catch {
		// ignore malformed cookie
	}
	return null;
}

export function redirectWithFlash(
	ctx: Ctx,
	location: string,
	type: Flash['type'],
	message: string
): never {
	setFlash(ctx, type, message);
	redirect(303, location);
}
