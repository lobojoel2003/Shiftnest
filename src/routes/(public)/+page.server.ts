import { getDb } from '#lib/server/db/index.ts';
import { listPublicEvents } from '#lib/server/events.ts';
import { upcomingShifts } from '#lib/server/shifts.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const db = getDb();
	const now = Date.now();
	const events = listPublicEvents(db, now);
	const soon = upcomingShifts(db, { now, onlyOpen: true, limit: 6, until: now + 14 * 86_400_000 });
	return {
		now,
		events: events.map((e) => ({
			id: e.id,
			slug: e.slug,
			title: e.title,
			summary: e.summary,
			location: e.location,
			nextStart: e.next_start,
			upcomingShifts: e.upcoming_shifts,
			capacity: e.capacity,
			filled: e.filled
		})),
		soon: soon.map((s) => ({
			id: s.id,
			role: s.role,
			startsAt: s.starts_at,
			endsAt: s.ends_at,
			open: s.open,
			coverNeeded: s.cover_needed,
			eventTitle: s.event_title,
			eventSlug: s.event_slug
		}))
	};
};
