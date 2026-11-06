/** Test helpers: an in-memory database with a published event and a shift. */
import { openDatabase, type DB } from './db';
import { createEvent } from './events';
import { createShift } from './shifts';
import { createVolunteer } from './volunteers';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
/** A fixed "now" so tests are deterministic: 2026-03-02T15:00:00Z (a Monday). */
export const NOW = Date.UTC(2026, 2, 2, 15, 0, 0);

export function testDb(): DB {
	return openDatabase(':memory:');
}

export function fixture(
	db: DB,
	opts: { capacity?: number; startsIn?: number; status?: 'published' | 'draft' } = {}
) {
	const event = createEvent(
		db,
		{ title: 'Food Distribution', location: '120 Main St', status: opts.status ?? 'published' },
		NOW
	);
	const startsAt = NOW + (opts.startsIn ?? 3 * DAY);
	const shiftId = createShift(
		db,
		event.id,
		{ role: 'Sorting', startsAt, endsAt: startsAt + 2 * HOUR, capacity: opts.capacity ?? 2 },
		NOW
	);
	const volunteer = (name: string) =>
		createVolunteer(db, { name, email: `${name.toLowerCase()}@example.com` }, NOW);
	return { event, shiftId, startsAt, volunteer };
}
