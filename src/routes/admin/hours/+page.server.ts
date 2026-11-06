import { getDb } from '#lib/server/db/index.ts';
import { hoursByEvent, hoursByVolunteer, totalHours } from '#lib/server/hours.ts';
import { getSettings } from '#lib/server/settings.ts';
import { resolveRange } from '#lib/server/ranges.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const db = getDb();
	const settings = getSettings(db);
	const range = resolveRange(url, settings.timezone);
	const params = {
		from: range.fromMs,
		to: range.toMs,
		assumeAttendance: settings.assumeAttendance
	};
	return {
		from: range.from,
		to: range.to,
		presets: range.presets,
		assumeAttendance: settings.assumeAttendance,
		total: totalHours(db, params),
		byVolunteer: hoursByVolunteer(db, params),
		byEvent: hoursByEvent(db, params)
	};
};
