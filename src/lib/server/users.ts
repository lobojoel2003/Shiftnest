import type { Role, SessionUser } from '../types';
import { dummyPasswordHash, hashPassword, randomToken, sha256, verifyPassword } from './crypto';
import type { DB } from './db';

export interface UserRow {
	id: number;
	email: string;
	name: string;
	password_hash: string | null;
	role: Role;
	notify: number;
	created_at: number;
	last_login_at: number | null;
}

export function countUsers(db: DB): number {
	return (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
}

export function getUser(db: DB, id: number): UserRow | undefined {
	return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function getUserByEmail(db: DB, email: string): UserRow | undefined {
	return db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim()) as UserRow | undefined;
}

export function listUsers(db: DB): UserRow[] {
	return db
		.prepare("SELECT * FROM users ORDER BY role = 'owner' DESC, name COLLATE NOCASE")
		.all() as UserRow[];
}

export function toSessionUser(row: UserRow): SessionUser {
	return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export async function createUser(
	db: DB,
	input: { email: string; name: string; password?: string; role: Role },
	now = Date.now()
): Promise<UserRow> {
	const hash = input.password ? await hashPassword(input.password) : null;
	const info = db
		.prepare(
			'INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
		)
		.run(input.email.trim(), input.name.trim(), hash, input.role, now);
	return getUser(db, Number(info.lastInsertRowid))!;
}

/** Create the owner account during first-run setup. Fails if any user already exists. */
export async function createFirstOwner(
	db: DB,
	input: { email: string; name: string; password: string },
	now = Date.now()
): Promise<UserRow | null> {
	const hash = await hashPassword(input.password);
	return db
		.transaction(() => {
			if (countUsers(db) > 0) return null;
			const info = db
				.prepare(
					`INSERT INTO users (email, name, password_hash, role, created_at, last_login_at)
				 VALUES (?, ?, ?, 'owner', ?, ?)`
				)
				.run(input.email.trim(), input.name.trim(), hash, now, now);
			return getUser(db, Number(info.lastInsertRowid)) ?? null;
		})
		.immediate();
}

export const MIN_PASSWORD = 10;

export function passwordProblem(password: string, confirm?: string): string | null {
	if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
	if (password.length > 200) return 'That password is too long.';
	if (confirm !== undefined && password !== confirm) return 'The passwords don’t match.';
	return null;
}

/** Check credentials. Always does the same amount of hashing work, found or not. */
export async function authenticate(
	db: DB,
	email: string,
	password: string,
	now = Date.now()
): Promise<UserRow | null> {
	const user = getUserByEmail(db, email);
	const ok = await verifyPassword(password, user?.password_hash ?? (await dummyPasswordHash()));
	if (!user || !user.password_hash || !ok) return null;
	db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, user.id);
	return user;
}

export async function setPassword(db: DB, userId: number, password: string): Promise<void> {
	const hash = await hashPassword(password);
	db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
	// Changing the password signs out every other session.
	db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function updateUser(
	db: DB,
	userId: number,
	patch: { name?: string; email?: string; notify?: boolean; role?: Role }
): void {
	const user = getUser(db, userId);
	if (!user) return;
	db.prepare('UPDATE users SET name = ?, email = ?, notify = ?, role = ? WHERE id = ?').run(
		patch.name?.trim() ?? user.name,
		patch.email?.trim() ?? user.email,
		patch.notify === undefined ? user.notify : patch.notify ? 1 : 0,
		patch.role ?? user.role,
		userId
	);
}

export function deleteUser(db: DB, userId: number): void {
	db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

/** Coordinators who want email alerts about cancellations and swaps. */
export function alertRecipients(db: DB): UserRow[] {
	return db.prepare('SELECT * FROM users WHERE notify = 1').all() as UserRow[];
}

// --- One-time tokens for invites and password resets --------------------------------

export function createAuthToken(
	db: DB,
	userId: number,
	purpose: 'invite' | 'reset',
	ttlMs: number,
	now = Date.now()
): string {
	const token = randomToken();
	// Only one live token of each kind per user.
	db.prepare('DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?').run(userId, purpose);
	db.prepare(
		'INSERT INTO auth_tokens (id, user_id, purpose, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
	).run(sha256(token), userId, purpose, now + ttlMs, now);
	return token;
}

export function peekAuthToken(
	db: DB,
	token: string,
	purpose: 'invite' | 'reset',
	now = Date.now()
): UserRow | null {
	const row = db
		.prepare(
			'SELECT user_id FROM auth_tokens WHERE id = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?'
		)
		.get(sha256(token), purpose, now) as { user_id: number } | undefined;
	return row ? (getUser(db, row.user_id) ?? null) : null;
}

export function consumeAuthToken(
	db: DB,
	token: string,
	purpose: 'invite' | 'reset',
	now = Date.now()
): UserRow | null {
	const user = peekAuthToken(db, token, purpose, now);
	if (!user) return null;
	db.prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ?').run(now, sha256(token));
	return user;
}
