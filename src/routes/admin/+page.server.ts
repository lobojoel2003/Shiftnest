import { getDb } from '#lib/server/db/index.ts';
import { totalHours } from '#lib/server/hours.ts';
import { getSettings } from '#lib/server/settings.ts';
import { upcomingShifts } from '#lib/server/shifts.ts';
import { openSwaps, recentSignups } from '#lib/server/signups.ts';
import { countVolunteers } from '#lib/server/volunteers.ts';
import { dayKey, zonedToUtc } from '#lib/time.ts';
import type { PageServerLoad } from './$types';
import { requireCoordinator } from '#lib/server/guards.ts';

const DAY = 86_400_000;

export const load: PageServerLoad = ({ locals }) => {
	requireCoordinator(locals);
	const db = getDb();
	const settings = getSettings(db);
	const now = Date.now();
	const week = upcomingShifts(db, { now, until: now + 7 * DAY, limit: 1000 });
	const monthStart = zonedToUtc(
		`${dayKey(now, settings.timezone).slice(0, 7)}-01`,
		'00:00',
		settings.timezone
	);
	const month = totalHours(db, {
		from: monthStart,
		to: now + DAY,
		assumeAttendance: settings.assumeAttendance,
		now
	});

	return {
		now,
		stats: {
			shiftsThisWeek: week.length,
			openSpotsThisWeek: week.reduce((sum, s) => sum + s.open, 0),
			filledThisWeek: week.reduce((sum, s) => sum + Math.min(s.filled, s.capacity), 0),
			capacityThisWeek: week.reduce((sum, s) => sum + s.capacity, 0),
			volunteers: countVolunteers(db),
			hoursThisMonth: month.hours
		},
		needs: upcomingShifts(db, { now, until: now + 14 * DAY, onlyOpen: true, limit: 8 }).map(
			(s) => ({
				id: s.id,
				role: s.role,
				eventTitle: s.event_title,
				startsAt: s.starts_at,
				endsAt: s.ends_at,
				filled: s.filled,
				capacity: s.capacity,
				coverNeeded: s.cover_needed
			})
		),
		swaps: openSwaps(db, { now })
			.slice(0, 6)
			.map((s) => ({
				id: s.id,
				shiftId: s.shift_id,
				role: s.role,
				startsAt: s.starts_at,
				endsAt: s.ends_at,
				volunteerName: s.volunteer_name,
				requestedAt: s.swap_requested_at
			})),
		recent: recentSignups(db, 8).map((s) => ({
			id: s.id,
			shiftId: s.shift_id,
			volunteerId: s.volunteer_id,
			volunteerName: s.volunteer_name,
			role: s.role,
			eventTitle: s.event_title,
			startsAt: s.starts_at,
			createdAt: s.created_at
		}))
	};
};
