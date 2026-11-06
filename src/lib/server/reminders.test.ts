import { describe, expect, it } from 'vitest';
import { processOutbox, type Transports } from './outbox';
import { dueOffsets, processReminders } from './reminders';
import { updateSettings } from './settings';
import { signUp } from './signups';
import { DAY, fixture, HOUR, NOW, testDb } from './testing';
import { updateVolunteer } from './volunteers';

describe('dueOffsets', () => {
	const start = NOW + 30 * HOUR;
	it('fires each offset once its time arrives', () => {
		expect(dueOffsets(start, NOW, [24, 2], new Set(), NOW)).toEqual([]);
		expect(dueOffsets(start, NOW, [24, 2], new Set(), start - 24 * HOUR)).toEqual([24]);
		expect(dueOffsets(start, NOW, [24, 2], new Set([24]), start - 2 * HOUR)).toEqual([2]);
	});

	it('skips reminders scheduled before the person signed up', () => {
		const signedUpLate = start - 10 * HOUR;
		expect(dueOffsets(start, signedUpLate, [24, 2], new Set(), start - 2 * HOUR)).toEqual([2]);
	});
});

function outboxKinds(db: ReturnType<typeof testDb>) {
	return db.prepare('SELECT channel, kind, recipient FROM outbox ORDER BY id').all() as {
		channel: string;
		kind: string;
		recipient: string;
	}[];
}

describe('processReminders', () => {
	it('queues one email per due offset and never twice', () => {
		const db = testDb();
		updateSettings(db, { reminderHours: [24, 2] });
		const { shiftId, startsAt, volunteer } = fixture(db, { startsIn: 3 * DAY });
		signUp(db, { shiftId, volunteerId: volunteer('Ana').id, now: NOW });

		expect(processReminders(db, { now: NOW, smsEnabled: false })).toBe(0);
		expect(processReminders(db, { now: startsAt - 23 * HOUR, smsEnabled: false })).toBe(1);
		expect(processReminders(db, { now: startsAt - 22 * HOUR, smsEnabled: false })).toBe(0);
		expect(processReminders(db, { now: startsAt - HOUR, smsEnabled: false })).toBe(1);
		expect(outboxKinds(db).filter((m) => m.kind === 'reminder')).toHaveLength(2);
	});

	it('collapses missed reminders into one message after downtime', () => {
		const db = testDb();
		updateSettings(db, { reminderHours: [24, 2] });
		const { shiftId, startsAt, volunteer } = fixture(db, { startsIn: 3 * DAY });
		signUp(db, { shiftId, volunteerId: volunteer('Ana').id, now: NOW });
		expect(processReminders(db, { now: startsAt - HOUR, smsEnabled: false })).toBe(1);
		expect(processReminders(db, { now: startsAt - 0.5 * HOUR, smsEnabled: false })).toBe(0);
	});

	it('sends texts only to volunteers who opted in', () => {
		const db = testDb();
		updateSettings(db, { reminderHours: [], smsReminderHours: [2] });
		const { shiftId, startsAt, volunteer } = fixture(db, { startsIn: 3 * DAY });
		const ana = volunteer('Ana');
		const ben = volunteer('Ben');
		updateVolunteer(db, ana.id, { phone: '+15551234567', smsOptIn: true });
		signUp(db, { shiftId, volunteerId: ana.id, now: NOW });
		signUp(db, { shiftId, volunteerId: ben.id, now: NOW });
		processReminders(db, { now: startsAt - HOUR, smsEnabled: true });
		expect(outboxKinds(db)).toEqual([
			{ channel: 'sms', kind: 'reminder', recipient: '+15551234567' }
		]);
	});
});

describe('processOutbox', () => {
	it('delivers, retries with back-off, and gives up after five attempts', async () => {
		const db = testDb();
		db.prepare(
			`INSERT INTO outbox (channel, recipient, subject, body_text, kind, send_after, created_at)
			 VALUES ('email', 'a@example.com', 'Hi', 'Hello', 'test', ?, ?)`
		).run(NOW, NOW);
		const sent: string[] = [];
		let fail = true;
		const t: Transports = {
			email: async (m) => {
				if (fail) throw new Error('SMTP down');
				sent.push(m.to);
			},
			sms: null
		};
		await processOutbox(db, t, NOW);
		const row = () =>
			db.prepare('SELECT * FROM outbox').get() as {
				status: string;
				attempts: number;
				send_after: number;
			};
		expect(row()).toMatchObject({ status: 'pending', attempts: 1 });
		expect(row().send_after).toBe(NOW + 60_000);

		// Not due yet.
		expect(await processOutbox(db, t, NOW + 1000)).toBe(0);

		fail = false;
		await processOutbox(db, t, NOW + 61_000);
		expect(row().status).toBe('sent');
		expect(sent).toEqual(['a@example.com']);
	});

	it('logs messages when no transport is configured', async () => {
		const db = testDb();
		db.prepare(
			`INSERT INTO outbox (channel, recipient, subject, body_text, kind, send_after, created_at)
			 VALUES ('sms', '+15550000000', '', 'Hello', 'test', ?, ?)`
		).run(NOW, NOW);
		await processOutbox(db, { email: null, sms: null }, NOW);
		expect((db.prepare('SELECT status FROM outbox').get() as { status: string }).status).toBe(
			'logged'
		);
	});
});

describe('private links in the message log', () => {
	it('stores a redacted copy and drops the private one after delivery', async () => {
		const db = testDb();
		const { queueEmail } = await import('./outbox');
		queueEmail(
			db,
			{
				to: 'a@example.com',
				subject: 'Link',
				text: 'Open http://x.org/v/SECRETTOKEN123',
				kind: 'portal_link'
			},
			NOW
		);
		const row = () =>
			db.prepare('SELECT body_text, private_text FROM outbox').get() as {
				body_text: string;
				private_text: string | null;
			};
		expect(row().body_text).toBe('Open [private link hidden]');
		expect(row().private_text).toContain('SECRETTOKEN123');

		const delivered: string[] = [];
		await processOutbox(db, { email: async (m) => void delivered.push(m.text), sms: null }, NOW);
		expect(delivered[0]).toContain('SECRETTOKEN123');
		expect(row().private_text).toBeNull();
	});
});
