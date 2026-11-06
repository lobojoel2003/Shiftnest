import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { shiftCalendar } from '#lib/server/feeds.ts';
import { icsResponse } from '#lib/server/ical.ts';
import { getShift } from '#lib/server/shifts.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const db = getDb();
	const shift = getShift(db, Number(params.id));
	if (!shift || shift.event_status === 'draft') error(404, 'Shift not found');
	return icsResponse(shiftCalendar(db, shift), `shift-${shift.id}.ics`, true);
};
