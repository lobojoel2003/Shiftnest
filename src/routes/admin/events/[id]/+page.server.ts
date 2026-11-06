import { error, fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { deleteEvent, getEvent, setEventStatus, updateEvent } from '#lib/server/events.ts';
import { redirectWithFlash } from '#lib/server/flash.ts';
import { readEventForm, readShiftForm } from '#lib/server/forms.ts';
import { notifyShiftDeleted } from '#lib/server/notifications.ts';
import { getSettings } from '#lib/server/settings.ts';
import { createShifts, listShiftsForEvent } from '#lib/server/shifts.ts';
import { upcomingSignupsForEvent } from '#lib/server/signups.ts';
import { AppError, text } from '#lib/server/validation.ts';
import { addDays, dayKey, utcToZoned } from '#lib/time.ts';
import type { EventStatus } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

function loadEvent(id: string) {
	const event = getEvent(getDb(), Number(id));
	if (!event) error(404, 'Event not found');
	return event;
}

export const load: PageServerLoad = ({ params, url }) => {
	const db = getDb();
	const event = loadEvent(params.id);
	const settings = getSettings(db);
	const now = Date.now();
	const showPast = url.searchParams.has('past');
	const all = listShiftsForEvent(db, event.id);
	const shifts = showPast ? all : all.filter((s) => s.ends_at > now);
	const last = all.at(-1);
	const template = last ? utcToZoned(last.starts_at, settings.timezone) : null;
	const endTemplate = last ? utcToZoned(last.ends_at, settings.timezone) : null;
	const nextDate = last ? addDays(template!.date, 7) : addDays(dayKey(now, settings.timezone), 1);

	return {
		now,
		showPast,
		pastCount: all.length - all.filter((s) => s.ends_at > now).length,
		event,
		roles: [...new Set(all.map((s) => s.role))].sort(),
		shifts: shifts.map((s) => ({
			id: s.id,
			role: s.role,
			startsAt: s.starts_at,
			endsAt: s.ends_at,
			capacity: s.capacity,
			filled: s.filled,
			coverNeeded: s.cover_needed,
			location: s.location,
			past: s.ends_at <= now
		})),
		defaults: {
			role: last?.role ?? '',
			date: nextDate,
			start: template?.time ?? '09:00',
			end: endTemplate?.time ?? '12:00',
			capacity: last?.capacity ?? 4,
			location: '',
			notes: '',
			repeat: 'none',
			count: 4
		},
		publicUrl: `${url.origin}/events/${event.slug}`
	};
};

export const actions: Actions = {
	update: async (event) => {
		const current = loadEvent(event.params.id);
		const { values, errors } = readEventForm(await event.request.formData());
		if (Object.keys(errors).length) return fail(400, { eventForm: { values, errors } });
		updateEvent(getDb(), current.id, values);
		redirectWithFlash(event, `/admin/events/${current.id}`, 'success', 'Event saved.');
	},

	status: async (event) => {
		const current = loadEvent(event.params.id);
		const status = text(await event.request.formData(), 'status', 20) as EventStatus;
		if (!['draft', 'published', 'archived'].includes(status)) return fail(400);
		setEventStatus(getDb(), current.id, status);
		const message =
			status === 'published'
				? 'Published! Volunteers can now sign up.'
				: status === 'draft'
					? 'Moved back to draft. The sign-up page is hidden.'
					: 'Archived. It’s hidden but kept for your records and hour totals.';
		redirectWithFlash(event, `/admin/events/${current.id}`, 'success', message);
	},

	addShifts: async (event) => {
		const db = getDb();
		const current = loadEvent(event.params.id);
		const settings = getSettings(db);
		const parsed = readShiftForm(await event.request.formData(), settings.timezone);
		if (!parsed.details || !parsed.times) {
			return fail(400, { shiftForm: { values: parsed.values, errors: parsed.errors } });
		}
		try {
			const ids = createShifts(db, current.id, parsed.details, parsed.times);
			redirectWithFlash(
				event,
				`/admin/events/${current.id}`,
				'success',
				ids.length === 1 ? 'Shift added.' : `${ids.length} shifts added.`
			);
		} catch (err) {
			if (err instanceof AppError) {
				return fail(400, { shiftForm: { values: parsed.values, errors: { role: err.message } } });
			}
			throw err;
		}
	},

	delete: async (event) => {
		const db = getDb();
		const current = loadEvent(event.params.id);
		const affected = upcomingSignupsForEvent(db, current.id);
		notifyShiftDeleted(db, affected);
		deleteEvent(db, current.id);
		redirectWithFlash(
			event,
			'/admin/events',
			'success',
			affected.length
				? `Event deleted. We let ${affected.length} signed-up volunteer${affected.length === 1 ? '' : 's'} know.`
				: 'Event deleted.'
		);
	}
};
