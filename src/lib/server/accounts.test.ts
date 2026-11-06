import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './crypto';
import { hoursByEvent, hoursByVolunteer, totalHours, volunteerTotalHours } from './hours';
import { createSession, getUserSession, getVolunteerSession, USER_SESSION_TTL } from './sessions';
import { getSettings, parseHoursList, updateSettings } from './settings';
import { setAttendance, signUp } from './signups';
import { DAY, fixture, HOUR, NOW, testDb } from './testing';
import {
	authenticate,
	consumeAuthToken,
	createAuthToken,
	createUser,
	peekAuthToken
} from './users';
import { isEmail, maskEmail, normalizePhone, safeRedirectPath, slugify } from './validation';
import { findOrCreateVolunteer, listVolunteers, rotateVolunteerTokens } from './volunteers';

describe('passwords', () => {
	it('hashes with a salt and verifies', async () => {
		const a = await hashPassword('correct horse');
		const b = await hashPassword('correct horse');
		expect(a).not.toBe(b);
		expect(await verifyPassword('correct horse', a)).toBe(true);
		expect(await verifyPassword('wrong', a)).toBe(false);
		expect(await verifyPassword('x', null)).toBe(false);
	});

	it('authenticates users case-insensitively by email', async () => {
		const db = testDb();
		await createUser(db, {
			email: 'Alex@Example.org',
			name: 'Alex',
			password: 'long-password',
			role: 'owner'
		});
		expect(await authenticate(db, 'alex@example.org', 'long-password')).toMatchObject({
			name: 'Alex'
		});
		expect(await authenticate(db, 'alex@example.org', 'nope')).toBeNull();
		expect(await authenticate(db, 'nobody@example.org', 'long-password')).toBeNull();
	});
});

describe('sessions and tokens', () => {
	it('creates, resolves and expires sessions', async () => {
		const db = testDb();
		const user = await createUser(db, { email: 'a@example.org', name: 'A', role: 'owner' });
		const token = createSession(db, { userId: user.id }, NOW);
		expect(getUserSession(db, token, NOW)?.id).toBe(user.id);
		expect(getUserSession(db, token, NOW + USER_SESSION_TTL + 1)).toBeNull();
		expect(getVolunteerSession(db, token, NOW)).toBeNull();
	});

	it('uses invite tokens once', async () => {
		const db = testDb();
		const user = await createUser(db, { email: 'a@example.org', name: 'A', role: 'coordinator' });
		const token = createAuthToken(db, user.id, 'invite', DAY, NOW);
		expect(peekAuthToken(db, token, 'reset', NOW)).toBeNull();
		expect(consumeAuthToken(db, token, 'invite', NOW)?.id).toBe(user.id);
		expect(consumeAuthToken(db, token, 'invite', NOW)).toBeNull();
	});

	it('rotating volunteer links signs out their devices', () => {
		const db = testDb();
		const { volunteer } = fixture(db);
		const ana = volunteer('Ana');
		const token = createSession(db, { volunteerId: ana.id }, NOW);
		rotateVolunteerTokens(db, ana.id);
		expect(getVolunteerSession(db, token, NOW)).toBeNull();
	});
});

describe('volunteers', () => {
	it('never overwrites an existing volunteer from a public form', () => {
		const db = testDb();
		const first = findOrCreateVolunteer(db, {
			name: 'Ana',
			email: 'ana@example.com',
			phone: '+15551112222'
		});
		const again = findOrCreateVolunteer(db, {
			name: 'Impostor',
			email: 'ANA@example.com',
			phone: ''
		});
		expect(first.created).toBe(true);
		expect(again.created).toBe(false);
		expect(again.volunteer.name).toBe('Ana');
	});

	it('searches with LIKE wildcards escaped', () => {
		const db = testDb();
		findOrCreateVolunteer(db, { name: 'Ana 100%', email: 'ana@example.com' });
		findOrCreateVolunteer(db, { name: 'Ben', email: 'ben@example.com' });
		expect(listVolunteers(db, { search: '100%', assumeAttendance: true }).items).toHaveLength(1);
		expect(listVolunteers(db, { search: '%', assumeAttendance: true }).total).toBe(1);
		expect(listVolunteers(db, { search: '_', assumeAttendance: true }).total).toBe(0);
		expect(listVolunteers(db, { assumeAttendance: true }).total).toBe(2);
	});
});

describe('hours', () => {
	it('counts attended shifts, overrides, and optionally unmarked past shifts', () => {
		const db = testDb();
		const { shiftId, startsAt, volunteer } = fixture(db, { capacity: 3 });
		const ana = volunteer('Ana');
		const ben = volunteer('Ben');
		const cy = volunteer('Cy');
		const a = signUp(db, { shiftId, volunteerId: ana.id, now: NOW });
		const b = signUp(db, { shiftId, volunteerId: ben.id, now: NOW });
		signUp(db, { shiftId, volunteerId: cy.id, now: NOW });
		setAttendance(db, { signupId: a, status: 'attended', hours: 3 });
		setAttendance(db, { signupId: b, status: 'no_show' });

		const after = startsAt + 3 * HOUR;
		const range = { from: 0, to: after + DAY, now: after };
		expect(totalHours(db, { ...range, assumeAttendance: true })).toEqual({ hours: 5, shifts: 2 });
		expect(totalHours(db, { ...range, assumeAttendance: false })).toEqual({ hours: 3, shifts: 1 });
		expect(hoursByVolunteer(db, { ...range, assumeAttendance: true }).map((r) => r.name)).toEqual([
			'Ana',
			'Cy'
		]);
		expect(hoursByEvent(db, { ...range, assumeAttendance: true })[0]).toMatchObject({
			volunteers: 2,
			hours: 5
		});
		expect(volunteerTotalHours(db, ben.id, true, after).hours).toBe(0);
	});
});

describe('settings', () => {
	it('stores typed values with defaults', () => {
		const db = testDb();
		expect(getSettings(db).reminderHours).toEqual([24, 2]);
		updateSettings(db, { orgName: 'Shelter', reminderHours: [48] });
		expect(getSettings(db)).toMatchObject({ orgName: 'Shelter', reminderHours: [48] });
	});

	it('parses reminder lists', () => {
		expect(parseHoursList('2, 24 24')).toEqual([24, 2]);
		expect(parseHoursList('')).toEqual([]);
		expect(parseHoursList('-1')).toBeNull();
		expect(parseHoursList('abc')).toBeNull();
	});
});

describe('validation', () => {
	it('checks emails', () => {
		expect(isEmail('ana@example.com')).toBe(true);
		expect(isEmail('ana@localhost')).toBe(false);
		expect(isEmail('a b@example.com')).toBe(false);
	});

	it('normalises phone numbers', () => {
		expect(normalizePhone('(555) 123-4567', '+1')).toBe('+15551234567');
		expect(normalizePhone('07700 900123', '+44')).toBe('+447700900123');
		expect(normalizePhone('0044 7700 900123', '+1')).toBe('+447700900123');
		expect(normalizePhone('', '+1')).toBe('');
		expect(normalizePhone('call me', '+1')).toBeNull();
		expect(normalizePhone('123', '+1')).toBeNull();
	});

	it('slugifies titles', () => {
		expect(slugify('Saturday Food Distribution!')).toBe('saturday-food-distribution');
		expect(slugify('Café & Crêpes')).toBe('cafe-crepes');
		expect(slugify('!!!')).toBe('event');
	});

	it('masks emails and blocks open redirects', () => {
		expect(maskEmail('maya@example.com')).toBe('m***@example.com');
		expect(safeRedirectPath('/admin/events')).toBe('/admin/events');
		expect(safeRedirectPath('//evil.example')).toBe('/');
		expect(safeRedirectPath('https://evil.example')).toBe('/');
		expect(safeRedirectPath('/\\evil.example')).toBe('/');
	});
});
