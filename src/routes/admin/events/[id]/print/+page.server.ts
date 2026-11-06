import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { getEvent } from '#lib/server/events.ts';
import { listShiftsForEvent } from '#lib/server/shifts.ts';
import { activeSignupsForShift } from '#lib/server/signups.ts';
import type { PageServerLoad } from './$types';
import { requireCoordinator } from '#lib/server/guards.ts';

export const load: PageServerLoad = ({ params, locals }) => {
	requireCoordinator(locals);
	const db = getDb();
	const event = getEvent(db, Number(params.id));
	if (!event) error(404, 'Event not found');
	const shifts = listShiftsForEvent(db, event.id, { from: Date.now() - 12 * 3_600_000 }).slice(
		0,
		60
	);
	return {
		event: { id: event.id, title: event.title, location: event.location },
		shifts: shifts.map((s) => ({
			id: s.id,
			role: s.role,
			startsAt: s.starts_at,
			endsAt: s.ends_at,
			capacity: s.capacity,
			people: activeSignupsForShift(db, s.id)
				.sort((a, b) => a.volunteer_name.localeCompare(b.volunteer_name))
				.map((p) => ({ id: p.id, name: p.volunteer_name, phone: p.volunteer_phone, note: p.note }))
		}))
	};
};
