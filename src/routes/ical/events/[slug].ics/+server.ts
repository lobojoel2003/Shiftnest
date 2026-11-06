import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { getEventBySlug } from '#lib/server/events.ts';
import { eventCalendar } from '#lib/server/feeds.ts';
import { icsResponse } from '#lib/server/ical.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const db = getDb();
	const event = getEventBySlug(db, params.slug);
	if (!event || event.status !== 'published') error(404, 'Calendar not found');
	return icsResponse(eventCalendar(db, event), `${event.slug}.ics`);
};
