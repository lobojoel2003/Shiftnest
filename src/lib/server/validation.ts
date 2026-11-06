/** Small, dependency-free helpers for reading and validating form posts. */

/** An error whose message is safe to show to the person who caused it. */
export class AppError extends Error {
	constructor(
		public code: string,
		message: string
	) {
		super(message);
		this.name = 'AppError';
	}
}

export function text(data: FormData, name: string, max = 500): string {
	const value = data.get(name);
	return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Multi-line text: trims, normalises line endings, caps length. */
export function longText(data: FormData, name: string, max = 5000): string {
	return text(data, name, max * 2)
		.replace(/\r\n?/g, '\n')
		.slice(0, max);
}

export function checkbox(data: FormData, name: string): boolean {
	const value = data.get(name);
	return value === 'on' || value === 'true' || value === '1';
}

export function int(data: FormData, name: string): number | null {
	const raw = text(data, name, 20);
	if (!/^-?\d+$/.test(raw)) return null;
	return Number.parseInt(raw, 10);
}

export function num(data: FormData, name: string): number | null {
	const raw = text(data, name, 20);
	if (raw === '') return null;
	const n = Number(raw);
	return Number.isFinite(n) ? n : null;
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

export function isEmail(value: string): boolean {
	return value.length <= 254 && EMAIL_RE.test(value);
}

export function normalizeEmail(value: string): string {
	return value.trim().toLowerCase();
}

/**
 * Normalise a phone number to E.164 where possible.
 * Returns '' for empty input and null if it doesn't look like a phone number.
 */
export function normalizePhone(input: string, countryCode = '+1'): string | null {
	const raw = input.trim();
	if (!raw) return '';
	if (!/^[\d\s().+-]+$/.test(raw)) return null;
	let digits = raw.replace(/[^\d+]/g, '');
	if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
	if (!digits.startsWith('+')) {
		const cc = countryCode.replace(/[^\d]/g, '');
		// Drop a domestic trunk prefix (0) and an already-typed country code.
		let local = digits.replace(/^0+/, '');
		if (cc && local.startsWith(cc) && local.length > 10) local = local.slice(cc.length);
		digits = `+${cc}${local}`;
	}
	const count = digits.replace(/\D/g, '').length;
	if (count < 8 || count > 15 || digits.indexOf('+', 1) !== -1) return null;
	return digits;
}

/** Make a URL slug from a title. */
export function slugify(input: string): string {
	return (
		input
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60)
			.replace(/-+$/g, '') || 'event'
	);
}

/** Mask an email for display to someone who might not own it: j***@example.org */
export function maskEmail(email: string): string {
	const [local, domain] = email.split('@');
	if (!domain) return email;
	return `${local.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(local.length - 1, 5)))}@${domain}`;
}

/** Only allow same-site relative redirects (no protocol-relative or absolute URLs). */
export function safeRedirectPath(value: string | null | undefined, fallback = '/'): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
		return fallback;
	}
	return value;
}
