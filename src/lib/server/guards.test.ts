import { describe, expect, it } from 'vitest';
import { isSafePath } from '../paths';
import { isAdminRequest, routedPath } from './guards';
import { HIDDEN_LINK, redactPrivateLinks } from './outbox';

describe('isAdminRequest', () => {
	it('uses the matched route', () => {
		expect(isAdminRequest('/admin/volunteers/export', '/%61dmin/volunteers/export')).toBe(true);
		expect(isAdminRequest('/admin', '/admin')).toBe(true);
		expect(isAdminRequest('/(public)/my', '/my')).toBe(false);
	});

	it('falls back to the decoded path when no route matched', () => {
		expect(isAdminRequest(null, '/%61dmin/anything')).toBe(true);
		expect(isAdminRequest(null, '/ADMIN')).toBe(true);
		expect(isAdminRequest(null, '//admin//x')).toBe(true);
		expect(isAdminRequest(null, '/administrator-guide')).toBe(false);
		expect(isAdminRequest(null, '/%E0%A4%A')).toBe(true); // undecodable: fail closed
	});

	it('decodes paths like the router', () => {
		expect(routedPath('/%61dmin//events')).toBe('/admin/events');
	});
});

describe('isSafePath', () => {
	it('allows same-site paths only', () => {
		expect(isSafePath('/events/saturday')).toBe(true);
		expect(isSafePath('/my?x=1')).toBe(true);
		for (const bad of [
			'//evil.example',
			'/\\evil.example',
			'https://evil.example',
			'/a\\b',
			'/a\tb',
			'',
			null
		]) {
			expect(isSafePath(bad), String(bad)).toBe(false);
		}
	});
});

describe('redactPrivateLinks', () => {
	it('hides personal, reset and invite links but keeps others', () => {
		const text =
			'Manage: https://x.org/v/abcDEF123_-xyz Reset: http://x.org/reset/AAAAAAAAAAAA Invite: https://x.org/invite/BBBBBBBBBB Event: https://x.org/events/pantry';
		const out = redactPrivateLinks(text);
		expect(out).not.toMatch(/\/(v|reset|invite)\//);
		expect(out.split(HIDDEN_LINK)).toHaveLength(4);
		expect(out).toContain('https://x.org/events/pantry');
	});
});
