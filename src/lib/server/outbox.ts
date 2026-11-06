import nodemailer from 'nodemailer';
import { config, type Config } from './config';
import type { DB } from './db';

/**
 * Outgoing email and text messages are written to the `outbox` table first and
 * delivered by a background worker with retries. When SMTP isn't configured,
 * messages are marked "logged" so they still show up in the admin message log.
 */

export type Channel = 'email' | 'sms';
export type OutboxStatus = 'pending' | 'sent' | 'failed' | 'logged';

export interface OutboxRow {
	id: number;
	channel: Channel;
	recipient: string;
	subject: string;
	body_text: string;
	body_html: string | null;
	kind: string;
	status: OutboxStatus;
	attempts: number;
	last_error: string | null;
	send_after: number;
	sent_at: number | null;
	created_at: number;
}

export interface EmailMessage {
	to: string;
	subject: string;
	text: string;
	html?: string;
	kind: string;
}

export interface SmsMessage {
	to: string;
	text: string;
	kind: string;
}

export interface Transports {
	email:
		((msg: { to: string; subject: string; text: string; html?: string }) => Promise<void>) | null;
	sms: ((msg: { to: string; text: string }) => Promise<void>) | null;
}

const MAX_ATTEMPTS = 5;

let kick: (() => void) | null = null;

/** Register a callback that wakes the worker when something is queued. */
export function onQueued(fn: (() => void) | null): void {
	kick = fn;
}

export function queueEmail(db: DB, msg: EmailMessage, now = Date.now()): number {
	const info = db
		.prepare(
			`INSERT INTO outbox (channel, recipient, subject, body_text, body_html, kind, send_after, created_at)
			 VALUES ('email', ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(msg.to, msg.subject, msg.text, msg.html ?? null, msg.kind, now, now);
	kick?.();
	return Number(info.lastInsertRowid);
}

export function queueSms(db: DB, msg: SmsMessage, now = Date.now()): number {
	const info = db
		.prepare(
			`INSERT INTO outbox (channel, recipient, subject, body_text, kind, send_after, created_at)
			 VALUES ('sms', ?, '', ?, ?, ?, ?)`
		)
		.run(msg.to, msg.text.slice(0, 640), msg.kind, now, now);
	kick?.();
	return Number(info.lastInsertRowid);
}

// --- Transports ------------------------------------------------------------------------

export function createEmailTransport(cfg: Config): Transports['email'] {
	if (!cfg.smtp) return null;
	const transporter = cfg.smtp.url
		? nodemailer.createTransport(cfg.smtp.url)
		: nodemailer.createTransport({
				host: cfg.smtp.host,
				port: cfg.smtp.port,
				secure: cfg.smtp.secure,
				auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.pass } : undefined
			});
	return async (msg) => {
		await transporter.sendMail({
			from: cfg.mailFrom,
			to: msg.to,
			subject: msg.subject,
			text: msg.text,
			html: msg.html
		});
	};
}

export function createSmsTransport(cfg: Config): Transports['sms'] {
	const twilio = cfg.twilio;
	if (!twilio) return null;
	return async (msg) => {
		const body = new URLSearchParams({ To: msg.to, Body: msg.text });
		if (twilio.messagingServiceSid) body.set('MessagingServiceSid', twilio.messagingServiceSid);
		else if (twilio.from) body.set('From', twilio.from);
		const res = await fetch(
			`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilio.accountSid)}/Messages.json`,
			{
				method: 'POST',
				headers: {
					authorization: `Basic ${Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString('base64')}`,
					'content-type': 'application/x-www-form-urlencoded'
				},
				body,
				signal: AbortSignal.timeout(15_000)
			}
		);
		if (!res.ok) {
			const detail = await res.text().catch(() => '');
			throw new Error(`Twilio responded ${res.status}: ${detail.slice(0, 300)}`);
		}
	};
}

let defaultTransports: Transports | null = null;

export function transports(): Transports {
	if (!defaultTransports) {
		const cfg = config();
		defaultTransports = { email: createEmailTransport(cfg), sms: createSmsTransport(cfg) };
	}
	return defaultTransports;
}

// --- Delivery --------------------------------------------------------------------------

function logToConsole(row: OutboxRow): void {
	if (config().production) {
		console.info(
			`[shiftnest] ${row.channel} not configured; logged "${row.kind}" to ${row.recipient}`
		);
		return;
	}
	const header = row.channel === 'email' ? `${row.subject}` : 'SMS';
	console.info(
		`\n[shiftnest] ✉  ${row.channel.toUpperCase()} to ${row.recipient} — ${header}\n${row.body_text}\n`
	);
}

/** Deliver due messages. Returns how many were processed. */
export async function processOutbox(
	db: DB,
	t: Transports = transports(),
	now = Date.now(),
	limit = 25
): Promise<number> {
	const due = db
		.prepare(
			`SELECT * FROM outbox WHERE status = 'pending' AND send_after <= ? ORDER BY id LIMIT ?`
		)
		.all(now, limit) as OutboxRow[];
	for (const row of due) {
		const send = row.channel === 'email' ? t.email : t.sms;
		if (!send) {
			logToConsole(row);
			db.prepare(`UPDATE outbox SET status = 'logged', sent_at = ? WHERE id = ?`).run(now, row.id);
			continue;
		}
		try {
			if (row.channel === 'email') {
				await t.email!({
					to: row.recipient,
					subject: row.subject,
					text: row.body_text,
					html: row.body_html ?? undefined
				});
			} else {
				await t.sms!({ to: row.recipient, text: row.body_text });
			}
			db.prepare(
				`UPDATE outbox SET status = 'sent', sent_at = ?, attempts = attempts + 1, last_error = NULL WHERE id = ?`
			).run(Date.now(), row.id);
		} catch (err) {
			const attempts = row.attempts + 1;
			const message = err instanceof Error ? err.message : String(err);
			const failed = attempts >= MAX_ATTEMPTS;
			// Back off 1, 4, 16, 64 minutes.
			const retryAt = now + 60_000 * 4 ** (attempts - 1);
			db.prepare(
				`UPDATE outbox SET status = ?, attempts = ?, last_error = ?, send_after = ? WHERE id = ?`
			).run(failed ? 'failed' : 'pending', attempts, message.slice(0, 500), retryAt, row.id);
			console.warn(
				`[shiftnest] ${row.channel} to ${row.recipient} failed (attempt ${attempts}): ${message}`
			);
		}
	}
	return due.length;
}

/** Retry a failed message from the admin message log. */
export function retryMessage(db: DB, id: number, now = Date.now()): void {
	db.prepare(
		`UPDATE outbox SET status = 'pending', attempts = 0, send_after = ? WHERE id = ? AND status = 'failed'`
	).run(now, id);
	kick?.();
}

/** Drop delivered messages after 90 days so the table doesn't grow forever. */
export function pruneOutbox(db: DB, now = Date.now()): void {
	db.prepare(`DELETE FROM outbox WHERE status <> 'pending' AND created_at < ?`).run(
		now - 90 * 86_400_000
	);
}

export function listOutbox(
	db: DB,
	opts: { status?: OutboxStatus | 'all'; limit?: number; offset?: number } = {}
): { items: OutboxRow[]; total: number; counts: Record<OutboxStatus, number> } {
	const status = opts.status ?? 'all';
	const where = status === 'all' ? '' : 'WHERE status = @status';
	const params = status === 'all' ? {} : { status };
	const items = db
		.prepare(`SELECT * FROM outbox ${where} ORDER BY id DESC LIMIT @limit OFFSET @offset`)
		.all({ ...params, limit: opts.limit ?? 50, offset: opts.offset ?? 0 }) as OutboxRow[];
	const total = (
		db.prepare(`SELECT COUNT(*) AS n FROM outbox ${where}`).get(params) as { n: number }
	).n;
	const counts = { pending: 0, sent: 0, failed: 0, logged: 0 } as Record<OutboxStatus, number>;
	for (const row of db
		.prepare('SELECT status, COUNT(*) AS n FROM outbox GROUP BY status')
		.all() as {
		status: OutboxStatus;
		n: number;
	}[]) {
		counts[row.status] = row.n;
	}
	return { items, total, counts };
}

export function getOutboxMessage(db: DB, id: number): OutboxRow | undefined {
	return db.prepare('SELECT * FROM outbox WHERE id = ?').get(id) as OutboxRow | undefined;
}
