import { getDb } from '#lib/server/db/index.ts';
import { listEvents } from '#lib/server/events.ts';
import type { EventStatus } from '#lib/types.ts';
import type { PageServerLoad } from './$types';
import { requireCoordinator } from '#lib/server/guards.ts';

export const load: PageServerLoad = ({ url, locals }) => {
	requireCoordinator(locals);
	const raw = url.searchParams.get('status') ?? 'active';
	const status = (
		['all', 'published', 'draft', 'archived', 'active'].includes(raw) ? raw : 'active'
	) as EventStatus | 'all' | 'active';
	const all = listEvents(getDb());
	const events = all.filter((e) =>
		status === 'all' ? true : status === 'active' ? e.status !== 'archived' : e.status === status
	);
	const counts = {
		active: all.filter((e) => e.status !== 'archived').length,
		published: all.filter((e) => e.status === 'published').length,
		draft: all.filter((e) => e.status === 'draft').length,
		archived: all.filter((e) => e.status === 'archived').length
	};
	return {
		now: Date.now(),
		status,
		counts,
		events: events.map((e) => ({
			id: e.id,
			slug: e.slug,
			title: e.title,
			location: e.location,
			status: e.status,
			nextStart: e.next_start,
			upcomingShifts: e.upcoming_shifts,
			capacity: e.capacity,
			filled: e.filled
		}))
	};
};
