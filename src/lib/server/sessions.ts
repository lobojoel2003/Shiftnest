import type { Cookies } from '@sveltejs/kit';
import type { SessionUser, SessionVolunteer } from '../types';
import { randomToken, sha256 } from './crypto';
import type { DB } from './db';

export const USER_COOKIE = 'sn_session';
export const VOLUNTEER_COOKIE = 'sn_volunteer';

const DAY = 86_400_000;
export const USER_SESSION_TTL = 30 * DAY;
export const VOLUNTEER_SESSION_TTL = 180 * DAY;

type Subject = { userId: number } | { volunteerId: number };

export function createSession(db: DB, subject: Subject, now = Date.now()): string {
	const token = randomToken();
	const isUser = 'userId' in subject;
	db.prepare(
		'INSERT INTO sessions (id, user_id, volunteer_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
	).run(
		sha256(token),
		isUser ? subject.userId : null,
		isUser ? null : subject.volunteerId,
		now + (isUser ? USER_SESSION_TTL : VOLUNTEER_SESSION_TTL),
		now
	);
	return token;
}

export function deleteSession(db: DB, token: string): void {
	db.prepare('DELETE FROM sessions WHERE id = ?').run(sha256(token));
}

export function purgeExpiredSessions(db: DB, now = Date.now()): void {
	db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
	db.prepare('DELETE FROM auth_tokens WHERE expires_at <= ?').run(now - 7 * DAY);
}

/** Look up a coordinator session, extending it when it's past the halfway point. */
export function getUserSession(db: DB, token: string, now = Date.now()): SessionUser | null {
	const row = db
		.prepare(
			`SELECT s.id AS sid, s.expires_at, u.id, u.email, u.name, u.role
			 FROM sessions s JOIN users u ON u.id = s.user_id
			 WHERE s.id = ? AND s.expires_at > ?`
		)
		.get(sha256(token), now) as (SessionUser & { sid: string; expires_at: number }) | undefined;
	if (!row) return null;
	if (row.expires_at - now < USER_SESSION_TTL / 2) {
		db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(
			now + USER_SESSION_TTL,
			row.sid
		);
	}
	return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export function getVolunteerSession(
	db: DB,
	token: string,
	now = Date.now()
): SessionVolunteer | null {
	const row = db
		.prepare(
			`SELECT v.id, v.name, v.email
			 FROM sessions s JOIN volunteers v ON v.id = s.volunteer_id
			 WHERE s.id = ? AND s.expires_at > ?`
		)
		.get(sha256(token), now) as SessionVolunteer | undefined;
	return row ?? null;
}

export function cookieOptions(url: URL, maxAgeMs: number) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		// Self-hosters often run plain HTTP on a LAN; only mark secure when we're on HTTPS.
		secure: url.protocol === 'https:',
		maxAge: Math.floor(maxAgeMs / 1000)
	};
}

export function startUserSession(db: DB, cookies: Cookies, url: URL, userId: number): void {
	const token = createSession(db, { userId });
	cookies.set(USER_COOKIE, token, cookieOptions(url, USER_SESSION_TTL));
}

export function startVolunteerSession(
	db: DB,
	cookies: Cookies,
	url: URL,
	volunteerId: number
): void {
	const existing = cookies.get(VOLUNTEER_COOKIE);
	if (existing) deleteSession(db, existing);
	const token = createSession(db, { volunteerId });
	cookies.set(VOLUNTEER_COOKIE, token, cookieOptions(url, VOLUNTEER_SESSION_TTL));
}

export function endSession(db: DB, cookies: Cookies, name: string): void {
	const token = cookies.get(name);
	if (token) deleteSession(db, token);
	cookies.delete(name, { path: '/' });
}
