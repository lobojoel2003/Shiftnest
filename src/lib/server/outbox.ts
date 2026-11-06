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
	/** What coordinators see in the message log: private links are hidden. */
	body_text: string;
	body_html: string | null;
	/** The real message, kept only until it's delivered. */
	private_text: string | null;
	private_html: string | null;
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

/**
 * Links that act as keys (a volunteer's personal page, password resets and
 * invitations). Coordinators must not be able to read them in the message log.
 */
const PRIVATE_LINK = /https?:\/\/[^\s"'<>]+?\/(?:v|reset|invite)\/[A-Za-z0-9_-]{8,}/g;
export const HIDDEN_LINK = '[private link hidden]';

export function redactPrivateLinks(text: string): string {
	return text.replace(PRIVATE_LINK, HIDDEN_LINK);
}

function insert(
	db: DB,
	row: {
		channel: Channel;
		to: string;
		subject: string;
		text: string;
		html: string | null;
		kind: string;
	},
	now: number
): number {
	const text = redactPrivateLinks(row.text);
	const html = row.html === null ? null : redactPrivateLinks(row.html);
	const isPrivate = text !== row.text || html !== row.html;
	const info = db
		.prepare(
			`INSERT INTO outbox (channel, recipient, subject, body_text, body_html, private_text, private_html, kind, send_after, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			row.channel,
			row.to,
			row.subject,
			text,
			html,
			isPrivate ? row.text : null,
			isPrivate ? row.html : null,
			row.kind,
			now,
			now
		);
	kick?.();
	return Number(info.lastInsertRowid);
}

export function queueEmail(db: DB, msg: EmailMessage, now = Date.now()): number {
	return insert(
		db,
		{
			channel: 'email',
			to: msg.to,
			subject: msg.subject,
			text: msg.text,
			html: msg.html ?? null,
			kind: msg.kind
		},
		now
	);
}

export function queueSms(db: DB, msg: SmsMessage, now = Date.now()): number {
	return insert(
		db,
		{
			channel: 'sms',
			to: msg.to,
			subject: '',
			text: msg.text.slice(0, 640),
			html: null,
			kind: msg.kind
		},
		now
	);
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
	// Development only: show the real links so you can click through.
	console.info(
		`\n[shiftnest] ✉  ${row.channel.toUpperCase()} to ${row.recipient} — ${header}\n${row.private_text ?? row.body_text}\n`
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
		const text = row.private_text ?? row.body_text;
		const html = row.private_html ?? row.body_html;
		if (row.channel === 'email' ? !t.email : !t.sms) {
			logToConsole(row);
			db.prepare(
				`UPDATE outbox SET status = 'logged', sent_at = ?, private_text = NULL, private_html = NULL WHERE id = ?`
			).run(now, row.id);
			continue;
		}
		try {
			if (row.channel === 'email') {
				await t.email!({ to: row.recipient, subject: row.subject, text, html: html ?? undefined });
			} else {
				await t.sms!({ to: row.recipient, text });
			}
			// Once delivered, the private copy is no longer needed.
			db.prepare(
				`UPDATE outbox SET status = 'sent', sent_at = ?, attempts = attempts + 1, last_error = NULL,
					private_text = NULL, private_html = NULL
				 WHERE id = ?`
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
