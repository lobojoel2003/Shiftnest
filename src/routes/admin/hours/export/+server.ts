import { csvResponse, toCsv } from '#lib/server/csv.ts';
import { getDb } from '#lib/server/db/index.ts';
import { hoursByVolunteer, hoursEntries } from '#lib/server/hours.ts';
import { resolveRange } from '#lib/server/ranges.ts';
import { getSettings } from '#lib/server/settings.ts';
import { utcToZoned } from '#lib/time.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const db = getDb();
	const settings = getSettings(db);
	const range = resolveRange(url, settings.timezone);
	const params = {
		from: range.fromMs,
		to: range.toMs,
		assumeAttendance: settings.assumeAttendance
	};
	const suffix = `${range.from}_to_${range.to}`;

	if (url.searchParams.get('kind') === 'entries') {
		const rows = hoursEntries(db, params).map((e) => {
			const start = utcToZoned(e.starts_at, settings.timezone);
			const end = utcToZoned(e.ends_at, settings.timezone);
			return [
				start.date,
				start.time,
				end.time,
				e.event_title,
				e.role,
				e.volunteer_name,
				e.volunteer_email,
				e.status === 'attended' ? 'attended' : 'completed (unmarked)',
				e.hours
			];
		});
		return csvResponse(
			toCsv(
				['Date', 'Start', 'End', 'Event', 'Role', 'Volunteer', 'Email', 'Status', 'Hours'],
				rows
			),
			`hours-by-shift_${suffix}.csv`
		);
	}

	const rows = hoursByVolunteer(db, params).map((v) => [v.name, v.email, v.shifts, v.hours]);
	return csvResponse(
		toCsv(['Volunteer', 'Email', 'Shifts', 'Hours'], rows),
		`hours-by-volunteer_${suffix}.csv`
	);
};
