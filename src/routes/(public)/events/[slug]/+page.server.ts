import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { getEventBySlug } from '#lib/server/events.ts';
import { listShiftsForEvent } from '#lib/server/shifts.ts';
import { openSwaps, volunteerSignupsByShift } from '#lib/server/signups.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals, url }) => {
	const db = getDb();
	const now = Date.now();
	const event = getEventBySlug(db, params.slug);
	if (!event || (event.status === 'draft' && !locals.user)) error(404, 'Event not found');

	const shifts = event.status === 'archived' ? [] : listShiftsForEvent(db, event.id, { from: now });
	const mine = locals.volunteer
		? volunteerSignupsByShift(db, locals.volunteer.id, event.id)
		: new Map();

	// One open cover request per shift that this visitor could take.
	const cover = new Map<number, string>();
	for (const s of openSwaps(db, { now, eventId: event.id })) {
		if (s.volunteer_id !== locals.volunteer?.id && !cover.has(s.shift_id) && s.swap_token) {
			cover.set(s.shift_id, s.swap_token);
		}
	}

	return {
		now,
		origin: url.origin,
		event: {
			id: event.id,
			slug: event.slug,
			title: event.title,
			summary: event.summary,
			description: event.description,
			location: event.location,
			status: event.status
		},
		shifts: shifts.map((s) => ({
			id: s.id,
			role: s.role,
			startsAt: s.starts_at,
			endsAt: s.ends_at,
			capacity: s.capacity,
			filled: s.filled,
			location: s.location,
			notes: s.notes,
			started: s.starts_at <= now,
			mine: mine.has(s.id),
			coverToken: cover.get(s.id) ?? null
		}))
	};
};
