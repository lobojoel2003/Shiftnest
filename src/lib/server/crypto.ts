import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/** URL-safe random token. 32 bytes = 256 bits of entropy. */
export function randomToken(bytes = 32): string {
	return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function scryptAsync(
	password: string,
	salt: Buffer,
	keylen: number,
	options: ScryptOptions
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
	});
}

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

/** Hash a password with scrypt. Format: `scrypt$N$r$p$salt$hash` (base64url). */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await scryptAsync(password.normalize('NFKC'), salt, KEYLEN, {
		N,
		r: R,
		p: P,
		maxmem: 64 * 1024 * 1024
	});
	return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
	if (!stored) return false;
	const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
	if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
	const expected = Buffer.from(hashB64, 'base64url');
	const actual = await scryptAsync(
		password.normalize('NFKC'),
		Buffer.from(saltB64, 'base64url'),
		expected.length,
		{ N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 }
	);
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A hash computed once so failed logins for unknown emails take the same time. */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
	dummyHash ??= hashPassword('not-a-real-password');
	return dummyHash;
}
