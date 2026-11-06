import { error, fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { getEvent } from '#lib/server/events.ts';
import { redirectWithFlash } from '#lib/server/flash.ts';
import { sendBroadcast } from '#lib/server/notifications.ts';
import { listShiftsForEvent } from '#lib/server/shifts.ts';
import { activeSignupsForShift, upcomingSignupsForEvent } from '#lib/server/signups.ts';
import { int, longText, text } from '#lib/server/validation.ts';
import type { Actions, PageServerLoad } from './$types';

function audience(eventId: number, shiftId: number | null) {
	const db = getDb();
	const signups = shiftId
		? activeSignupsForShift(db, shiftId).filter((s) => s.event_id === eventId)
		: upcomingSignupsForEvent(db, eventId);
	const seen = new Map<number, { name: string; email: string; manage_token: string }>();
	for (const s of signups) {
		seen.set(s.volunteer_id, {
			name: s.volunteer_name,
			email: s.volunteer_email,
			manage_token: s.volunteer_manage_token
		});
	}
	return [...seen.values()];
}

export const load: PageServerLoad = ({ params, url }) => {
	const db = getDb();
	const event = getEvent(db, Number(params.id));
	if (!event) error(404, 'Event not found');
	const shiftId = Number(url.searchParams.get('shift')) || null;
	return {
		event: { id: event.id, title: event.title },
		shiftId,
		shifts: listShiftsForEvent(db, event.id, { from: Date.now() - 86_400_000 }).map((s) => ({
			id: s.id,
			role: s.role,
			startsAt: s.starts_at,
			endsAt: s.ends_at,
			filled: s.filled
		})),
		recipients: audience(event.id, shiftId).map((r) => r.name)
	};
};

export const actions: Actions = {
	default: async (event) => {
		const db = getDb();
		const ev = getEvent(db, Number(event.params.id));
		if (!ev) error(404, 'Event not found');
		const data = await event.request.formData();
		const shiftId = int(data, 'shiftId') || null;
		const subject = text(data, 'subject', 150);
		const body = longText(data, 'body', 5000);
		const errors: Record<string, string> = {};
		if (!subject) errors.subject = 'Add a subject.';
		if (!body) errors.body = 'Write a message.';
		if (Object.keys(errors).length) return fail(400, { subject, body, errors });
		const recipients = audience(ev.id, shiftId);
		if (!recipients.length)
			return fail(400, {
				subject,
				body,
				errors: { body: 'No one is signed up yet.' } as Record<string, string>
			});
		const count = sendBroadcast(db, recipients, subject, body, event.locals.user!.name);
		redirectWithFlash(
			event,
			`/admin/events/${ev.id}`,
			'success',
			`Message sent to ${count} volunteer${count === 1 ? '' : 's'}.`
		);
	}
};
