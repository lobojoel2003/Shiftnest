import { csvResponse, toCsv } from '#lib/server/csv.ts';
import { getDb } from '#lib/server/db/index.ts';
import { getSettings } from '#lib/server/settings.ts';
import { listVolunteers } from '#lib/server/volunteers.ts';
import { utcToZoned } from '#lib/time.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const db = getDb();
	const settings = getSettings(db);
	const { items } = listVolunteers(db, {
		assumeAttendance: settings.assumeAttendance,
		limit: 1_000_000
	});
	const date = (ms: number | null) => (ms ? utcToZoned(ms, settings.timezone).date : '');
	return csvResponse(
		toCsv(
			[
				'Name',
				'Email',
				'Phone',
				'Text reminders',
				'Upcoming shifts',
				'Completed shifts',
				'No-shows',
				'Hours',
				'Last shift',
				'Joined',
				'Notes'
			],
			items.map((v) => [
				v.name,
				v.email,
				v.phone,
				v.sms_opt_in ? 'yes' : 'no',
				v.upcoming,
				v.completed,
				v.no_shows,
				v.hours,
				date(v.last_shift_at),
				date(v.created_at),
				v.notes
			])
		),
		`volunteers-${date(Date.now())}.csv`
	);
};
