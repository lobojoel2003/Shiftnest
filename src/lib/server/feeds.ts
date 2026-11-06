import { config } from './config';
import type { DB } from './db';
import type { EventRow } from './events';
import { buildCalendar, type IcsEvent } from './ical';
import { getSettings } from './settings';
import { listShiftsForEvent, type ShiftDetail } from './shifts';
import { signupsForVolunteer } from './signups';
import type { VolunteerRow } from './volunteers';

const DAY = 86_400_000;

function host(): string {
	try {
		return new URL(config().origin).host;
	} catch {
		return 'shiftnest.local';
	}
}

/** A volunteer's personal feed: their shifts from the last 60 days onward. */
export function volunteerCalendar(db: DB, v: VolunteerRow, now = Date.now()): string {
	const settings = getSettings(db);
	const events: IcsEvent[] = signupsForVolunteer(db, v.id)
		.filter((s) => s.ends_at > now - 60 * DAY && s.status !== 'no_show')
		.map((s) => ({
			uid: `signup-${s.id}@${host()}`,
			start: s.starts_at,
			end: s.ends_at,
			summary: `${s.role} · ${s.event_title}`,
			location: s.shift_location || s.event_location,
			description: [
				s.shift_notes,
				`${settings.orgName} volunteer shift.`,
				`Manage: ${config().origin}/my`
			]
				.filter(Boolean)
				.join('\n\n'),
			url: `${config().origin}/events/${s.event_slug}`,
			lastModified: s.updated_at,
			created: s.created_at,
			sequence: Math.floor(s.updated_at / 1000) % 2_000_000_000
		}));
	return buildCalendar({
		name: `${settings.orgName}: my shifts`,
		description: `Volunteer shifts for ${v.name}`,
		refreshMinutes: 60,
		events,
		now
	});
}

/** Public feed of every shift in an event. */
export function eventCalendar(db: DB, event: EventRow, now = Date.now()): string {
	const settings = getSettings(db);
	const shifts = listShiftsForEvent(db, event.id, { from: now - 30 * DAY });
	return buildCalendar({
		name: `${event.title} · ${settings.orgName}`,
		description: event.summary,
		refreshMinutes: 60,
		now,
		events: shifts.map((s) => ({
			uid: `shift-${s.id}@${host()}`,
			start: s.starts_at,
			end: s.ends_at,
			summary: `${s.role} · ${event.title}`,
			location: s.location || event.location,
			description: [
				s.notes,
				`${Math.max(0, s.capacity - s.filled)} of ${s.capacity} spots open.`,
				`Sign up: ${config().origin}/events/${event.slug}/${s.id}`
			]
				.filter(Boolean)
				.join('\n\n'),
			url: `${config().origin}/events/${event.slug}`,
			lastModified: s.updated_at,
			sequence: Math.floor(s.updated_at / 1000) % 2_000_000_000
		}))
	});
}

/** A single shift as a downloadable .ics file. */
export function shiftCalendar(db: DB, s: ShiftDetail, now = Date.now()): string {
	const settings = getSettings(db);
	return buildCalendar({
		name: `${s.role} · ${s.event_title}`,
		now,
		events: [
			{
				uid: `shift-${s.id}@${host()}`,
				start: s.starts_at,
				end: s.ends_at,
				summary: `${s.role} · ${s.event_title}`,
				location: s.location || s.event_location,
				description: [s.notes, `${settings.orgName} volunteer shift.`, `${config().origin}/my`]
					.filter(Boolean)
					.join('\n\n'),
				url: `${config().origin}/events/${s.event_slug}`,
				lastModified: s.updated_at,
				sequence: Math.floor(s.updated_at / 1000) % 2_000_000_000
			}
		]
	});
}
