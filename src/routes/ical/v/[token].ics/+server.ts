import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { volunteerCalendar } from '#lib/server/feeds.ts';
import { icsResponse } from '#lib/server/ical.ts';
import { getVolunteerByCalendarToken } from '#lib/server/volunteers.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const db = getDb();
	const volunteer = getVolunteerByCalendarToken(db, params.token);
	if (!volunteer) error(404, 'Calendar not found');
	return icsResponse(volunteerCalendar(db, volunteer), 'my-shifts.ics');
};
