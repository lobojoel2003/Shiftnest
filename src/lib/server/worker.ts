import { config } from './config';
import type { DB } from './db';
import { onQueued, processOutbox, pruneOutbox, transports } from './outbox';
import { processReminders } from './reminders';
import { purgeExpiredSessions } from './sessions';

/**
 * A single in-process loop that sends reminders and delivers queued messages.
 * Shiftnest is designed to run as one process with one SQLite file, so there's
 * no need for a separate job queue.
 */

let interval: ReturnType<typeof setInterval> | null = null;
let pendingKick: ReturnType<typeof setTimeout> | null = null;
let running = false;
let lastHousekeeping = 0;

export async function tick(db: DB): Promise<void> {
	if (running) return;
	running = true;
	try {
		const t = transports();
		processReminders(db, { smsEnabled: t.sms !== null });
		// Keep draining while there's a backlog.
		while ((await processOutbox(db, t)) === 25) {
			/* continue */
		}
		const now = Date.now();
		if (now - lastHousekeeping > 3_600_000) {
			lastHousekeeping = now;
			purgeExpiredSessions(db, now);
			pruneOutbox(db, now);
		}
	} catch (err) {
		console.error('[shiftnest] background worker error', err);
	} finally {
		running = false;
	}
}

export function startWorkers(db: DB): void {
	if (interval || !config().workersEnabled) return;
	onQueued(() => {
		if (pendingKick) return;
		pendingKick = setTimeout(() => {
			pendingKick = null;
			void tick(db);
		}, 250);
	});
	interval = setInterval(() => void tick(db), config().workerIntervalMs);
	interval.unref();
	setTimeout(() => void tick(db), 1000).unref();
}

export function stopWorkers(): void {
	if (interval) clearInterval(interval);
	if (pendingKick) clearTimeout(pendingKick);
	interval = null;
	pendingKick = null;
	onQueued(null);
}
