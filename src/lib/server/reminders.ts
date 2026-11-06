import type { DB } from './db';
import { notifyReminder } from './notifications';
import { getSettings } from './settings';
import { getSignupDetail } from './signups';

const HOUR = 3_600_000;

/**
 * Which reminder offsets (hours before start) are due for a sign-up.
 * An offset only applies if the person signed up before that reminder time;
 * someone who signs up two hours before a shift doesn't need a "tomorrow" email.
 */
export function dueOffsets(
	startsAt: number,
	createdAt: number,
	offsets: number[],
	alreadySent: ReadonlySet<number>,
	now: number
): number[] {
	return offsets.filter((h) => {
		const at = startsAt - h * HOUR;
		return at <= now && createdAt < at && !alreadySent.has(h);
	});
}

interface Candidate {
	id: number;
	created_at: number;
	starts_at: number;
	phone: string;
	sms_opt_in: number;
}

/**
 * Queue reminders that are due. If several are due at once (say the server was
 * down), only one message goes out and the rest are marked as handled.
 * Returns the number of reminders queued.
 */
export function processReminders(db: DB, opts: { now?: number; smsEnabled: boolean }): number {
	const now = opts.now ?? Date.now();
	const settings = getSettings(db);
	const channels: { channel: 'email' | 'sms'; offsets: number[] }[] = [
		{ channel: 'email', offsets: settings.reminderHours }
	];
	if (opts.smsEnabled) channels.push({ channel: 'sms', offsets: settings.smsReminderHours });

	const window = Math.max(0, ...channels.flatMap((c) => c.offsets));
	if (window === 0) return 0;

	const candidates = db
		.prepare(
			`SELECT su.id, su.created_at, sh.starts_at, v.phone, v.sms_opt_in
			 FROM signups su
			 JOIN shifts sh ON sh.id = su.shift_id
			 JOIN volunteers v ON v.id = su.volunteer_id
			 WHERE su.status = 'confirmed' AND sh.starts_at > ? AND sh.starts_at <= ?`
		)
		.all(now, now + window * HOUR) as Candidate[];

	const sentFor = db.prepare(
		'SELECT offset_hours FROM reminders_sent WHERE signup_id = ? AND channel = ?'
	);
	const markSent = db.prepare(
		'INSERT OR IGNORE INTO reminders_sent (signup_id, channel, offset_hours, sent_at) VALUES (?, ?, ?, ?)'
	);

	let queued = 0;
	for (const c of candidates) {
		for (const { channel, offsets } of channels) {
			if (channel === 'sms' && !(c.sms_opt_in && c.phone)) continue;
			const sent = new Set(
				(sentFor.all(c.id, channel) as { offset_hours: number }[]).map((r) => r.offset_hours)
			);
			const due = dueOffsets(c.starts_at, c.created_at, offsets, sent, now);
			if (due.length === 0) continue;
			db.transaction(() => {
				for (const h of due) markSent.run(c.id, channel, h, now);
				const detail = getSignupDetail(db, c.id);
				if (detail) notifyReminder(db, detail, channel, settings);
			})();
			queued++;
		}
	}
	return queued;
}
