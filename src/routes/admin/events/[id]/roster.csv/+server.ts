import { error } from '@sveltejs/kit';
import { csvResponse, toCsv } from '#lib/server/csv.ts';
import { getDb } from '#lib/server/db/index.ts';
import { getEvent } from '#lib/server/events.ts';
import { getSettings } from '#lib/server/settings.ts';
import { listShiftsForEvent } from '#lib/server/shifts.ts';
import { rosterForShift } from '#lib/server/signups.ts';
import { utcToZoned } from '#lib/time.ts';
import type { RequestHandler } from './$types';
import { requireCoordinator } from '#lib/server/guards.ts';

export const GET: RequestHandler = ({ params, locals }) => {
	requireCoordinator(locals);
	const db = getDb();
	const event = getEvent(db, Number(params.id));
	if (!event) error(404, 'Event not found');
	const tz = getSettings(db).timezone;
	const rows: unknown[][] = [];
	for (const shift of listShiftsForEvent(db, event.id)) {
		const start = utcToZoned(shift.starts_at, tz);
		const end = utcToZoned(shift.ends_at, tz);
		for (const s of rosterForShift(db, shift.id)) {
			if (s.status === 'cancelled') continue;
			rows.push([
				start.date,
				start.time,
				end.time,
				shift.role,
				s.volunteer_name,
				s.volunteer_email,
				s.volunteer_phone,
				s.status,
				s.note
			]);
		}
	}
	return csvResponse(
		toCsv(['Date', 'Start', 'End', 'Role', 'Name', 'Email', 'Phone', 'Status', 'Note'], rows),
		`${event.slug}-roster.csv`
	);
};
