import { addDays, dayKey, zonedToUtc } from '../time';
import { config } from './config';
import type { DB } from './db';
import { createEvent } from './events';
import { updateSettings } from './settings';
import { createShifts } from './shifts';
import { countUsers, createUser } from './users';
import { createVolunteer, type VolunteerRow } from './volunteers';

/**
 * Seeds a realistic demo organisation (a community food bank) with events,
 * shifts, volunteers, sign-ups, attendance and a cover request.
 * Runs only when SHIFTNEST_DEMO=true and the database has no users yet.
 */

const VOLUNTEERS = [
	['Maya Patel', '+15550101001'],
	['James Okafor', ''],
	['Sofia Hernández', '+15550101003'],
	['Liam O’Connor', ''],
	['Aisha Rahman', '+15550101005'],
	['Noah Kim', ''],
	['Grace Mensah', '+15550101007'],
	['Ethan Brooks', ''],
	['Olivia Nguyen', '+15550101009'],
	['Daniel Schwartz', ''],
	['Fatima Al-Sayed', ''],
	['Lucas Silva', '+15550101012'],
	['Hannah Weiss', ''],
	['Marcus Johnson', '+15550101014'],
	['Priya Raman', ''],
	['Tomás García', ''],
	['Emily Chen', '+15550101017'],
	['Kwame Asante', ''],
	['Chloe Dubois', ''],
	['Ben Carter', '+15550101020'],
	['Yuki Tanaka', ''],
	['Rosa Martínez', ''],
	['Owen Davies', '+15550101023'],
	['Leila Haddad', '']
] as const;

/** Small deterministic PRNG so demo data (and screenshots) are stable. */
function mulberry32(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function emailFor(name: string): string {
	const local = name
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z]+/g, '.')
		.replace(/^\.|\.$/g, '');
	return `${local}@example.com`;
}

/** Next `weekday` (0 = Sunday) on or after `date`. */
function nextWeekday(date: string, weekday: number, tz: string): string {
	for (let i = 0; i < 7; i++) {
		const d = addDays(date, i);
		const w = new Date(zonedToUtc(d, '12:00', tz)).getUTCDay();
		if (w === weekday) return d;
	}
	return date;
}

export async function seedDemo(db: DB, now = Date.now()): Promise<boolean> {
	if (countUsers(db) > 0) return false;
	const tz = process.env.SHIFTNEST_DEMO_TIMEZONE || 'America/New_York';
	const rand = mulberry32(42);
	const today = dayKey(now, tz);
	const at = (date: string, time: string) => zonedToUtc(date, time, tz);

	updateSettings(db, {
		orgName: 'Riverside Community Food Bank',
		tagline:
			'Every week we sort, pack and hand out groceries for 400+ local families. No experience needed: pick a shift and we’ll show you the ropes.',
		contactEmail: 'volunteer@riverside-food.example.org',
		timezone: tz,
		locale: 'en-US',
		reminderHours: [24, 2],
		smsReminderHours: [2],
		cancelCutoffHours: 24,
		allowSelfCheckin: true,
		assumeAttendance: true
	});

	const password = config().demoPassword;
	await createUser(
		db,
		{ email: 'admin@example.org', name: 'Alex Rivera', password, role: 'owner' },
		now
	);
	await createUser(
		db,
		{ email: 'sam@example.org', name: 'Sam Chen', password, role: 'coordinator' },
		now
	);

	const volunteers: VolunteerRow[] = VOLUNTEERS.map(([name, phone], i) =>
		createVolunteer(
			db,
			{ name, email: emailFor(name), phone, smsOptIn: !!phone },
			now - (90 - i) * 86_400_000
		)
	);

	// --- Events & shifts ---------------------------------------------------------------
	const distribution = createEvent(
		db,
		{
			title: 'Saturday Food Distribution',
			summary: 'Set up, hand out groceries, and clean up at our weekly community pantry.',
			description:
				'Our biggest day of the week. Setup crew unloads the truck and builds stations; the distribution line greets families and helps carry groceries; cleanup restocks for next week.\n\nWear closed-toe shoes. Water and snacks provided. Parking is free behind the community center.',
			location: 'Riverside Community Center, 120 Main St',
			status: 'published'
		},
		now
	);
	const sorting = createEvent(
		db,
		{
			title: 'Warehouse Sorting Nights',
			summary: 'Sort donated food and check dates. Great for groups and first-timers.',
			description:
				'Sort donations into categories, check expiry dates and pack family boxes for Saturday. Teens 14+ welcome with a parent or guardian.',
			location: 'Warehouse B, 45 Dock Road',
			status: 'published'
		},
		now
	);
	const holiday = createEvent(
		db,
		{
			title: 'Holiday Meal Drive',
			summary: 'Pack and deliver 300 holiday meal boxes to families across the city.',
			description:
				'Our biggest drive of the year! Drivers need a valid licence and their own car; we’ll give you a route sheet and a thank-you mug.',
			location: 'St. Mark’s Hall, 9 Elm Street',
			status: 'published'
		},
		now
	);
	const garden = createEvent(
		db,
		{
			title: 'Community Garden Workday',
			summary: 'Help us put the garden beds to sleep for winter.',
			location: 'Riverside Community Garden',
			status: 'draft'
		},
		now
	);
	const backpacks = createEvent(
		db,
		{
			title: 'Back-to-School Backpack Drive',
			summary: 'Fill and hand out 250 backpacks with school supplies.',
			location: 'Riverside Community Center, 120 Main St',
			status: 'archived'
		},
		now
	);

	const shiftIds: { id: number; startsAt: number; endsAt: number; capacity: number }[] = [];
	const add = (
		eventId: number,
		role: string,
		capacity: number,
		dates: string[],
		start: string,
		end: string,
		notes = '',
		location = ''
	) => {
		const times = dates.map((d) => ({ startsAt: at(d, start), endsAt: at(d, end) }));
		const ids = createShifts(db, eventId, { role, capacity, notes, location }, times, now);
		ids.forEach((id, i) => shiftIds.push({ id, ...times[i], capacity }));
	};

	const firstSaturday = nextWeekday(addDays(today, 1), 6, tz);
	const saturdays = [-21, -14, -7, 0, 7, 14, 21].map((d) => addDays(firstSaturday, d));
	add(
		distribution.id,
		'Setup crew',
		4,
		saturdays,
		'08:00',
		'10:00',
		'Heavy lifting: pallets and tables.'
	);
	add(distribution.id, 'Distribution line', 8, saturdays, '10:00', '13:00');
	add(distribution.id, 'Cleanup & restock', 3, saturdays, '13:00', '14:30');

	const firstTuesday = nextWeekday(addDays(today, 1), 2, tz);
	const firstThursday = nextWeekday(addDays(today, 1), 4, tz);
	const evenings = [-14, -7, 0, 7, 14]
		.flatMap((d) => [addDays(firstTuesday, d), addDays(firstThursday, d)])
		.sort();
	add(sorting.id, 'Sorting & packing', 6, evenings, '18:00', '20:30');

	const holidayDay = addDays(firstSaturday, 14 + 1);
	add(
		holiday.id,
		'Box packing',
		12,
		[holidayDay],
		'08:00',
		'11:00',
		'Bring gloves if you have them.'
	);
	add(
		holiday.id,
		'Delivery driver',
		10,
		[holidayDay],
		'11:00',
		'14:00',
		'Valid driver’s licence and your own car.'
	);
	add(
		holiday.id,
		'Phone bank',
		4,
		[addDays(holidayDay, -3)],
		'17:00',
		'19:00',
		'Call families to confirm delivery times.',
		'Remote (we’ll send a call list)'
	);

	add(garden.id, 'Garden crew', 8, [addDays(firstSaturday, 28)], '09:00', '12:00');
	const backToSchool = addDays(today, -80);
	add(backpacks.id, 'Backpack packing', 10, [backToSchool], '10:00', '13:00');

	// --- Sign-ups ------------------------------------------------------------------------
	const insert = db.prepare(
		`INSERT INTO signups (shift_id, volunteer_id, status, created_at, updated_at, checked_in_at)
		 VALUES (?, ?, ?, ?, ?, ?)`
	);
	// Maya (volunteers[0]) is the demo volunteer; her shifts are set explicitly below.
	const pickVolunteers = (count: number) => {
		const pool = volunteers.slice(1);
		const chosen: VolunteerRow[] = [];
		while (chosen.length < count && pool.length) {
			chosen.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
		}
		return chosen;
	};

	db.transaction(() => {
		for (const shift of shiftIds) {
			const past = shift.endsAt < now;
			const soon = shift.startsAt - now < 10 * 86_400_000;
			// Past shifts were mostly full; near shifts fill faster than far ones.
			const ratio = past ? 0.75 + rand() * 0.25 : soon ? 0.45 + rand() * 0.55 : 0.15 + rand() * 0.5;
			const count = Math.min(shift.capacity, Math.round(shift.capacity * ratio));
			for (const v of pickVolunteers(count)) {
				const created = past
					? shift.startsAt - (2 + rand() * 12) * 86_400_000
					: now - (0.5 + rand() * 9 * 24) * 3_600_000;
				const status = past ? (rand() < 0.08 ? 'no_show' : 'attended') : 'confirmed';
				// About half of attendees tapped "I'm here" themselves.
				const checkedIn =
					status === 'attended' && rand() < 0.5
						? shift.startsAt - Math.round(rand() * 20) * 60_000
						: null;
				insert.run(shift.id, v.id, status, created, created, checkedIn);
			}
		}
	})();

	// One open cover request on the next distribution line shift.
	const nextLine = db
		.prepare(
			`SELECT su.id FROM signups su JOIN shifts sh ON sh.id = su.shift_id
			 WHERE sh.event_id = ? AND sh.role = 'Distribution line' AND sh.starts_at > ? AND su.status = 'confirmed'
			 ORDER BY sh.starts_at, su.id LIMIT 1`
		)
		.get(distribution.id, now) as { id: number } | undefined;
	if (nextLine) {
		db.prepare('UPDATE signups SET swap_token = ?, swap_requested_at = ? WHERE id = ?').run(
			'demo-cover-request',
			now - 5 * 3_600_000,
			nextLine.id
		);
	}

	// Maya is the demo volunteer: give her a predictable personal link.
	db.prepare('UPDATE volunteers SET manage_token = ?, calendar_token = ? WHERE id = ?').run(
		'demo-volunteer',
		'demo-calendar',
		volunteers[0].id
	);
	const openShift = (from: number, to: number, limit: number, eventIds: number[]) =>
		db
			.prepare(
				`SELECT sh.id, sh.starts_at FROM shifts sh
				 WHERE sh.event_id IN (${eventIds.map(() => '?').join(',')}) AND sh.starts_at > ? AND sh.starts_at < ?
				 AND (SELECT COUNT(*) FROM signups su WHERE su.shift_id = sh.id AND su.status <> 'cancelled') < sh.capacity
				 ORDER BY sh.starts_at LIMIT ?`
			)
			.all(...eventIds, from, to, limit) as { id: number; starts_at: number }[];
	// Some history (so her hours add up) and three upcoming shifts.
	for (const s of openShift(0, now - 86_400_000, 40, [distribution.id, sorting.id]).slice(0, 6)) {
		insert.run(
			s.id,
			volunteers[0].id,
			'attended',
			s.starts_at - 7 * 86_400_000,
			s.starts_at,
			s.starts_at - 300_000
		);
	}
	const mayaNext = [
		...openShift(now, now + 60 * 86_400_000, 1, [distribution.id]),
		...openShift(now, now + 60 * 86_400_000, 1, [sorting.id]),
		...openShift(now, now + 60 * 86_400_000, 1, [holiday.id])
	];
	for (const s of mayaNext) {
		insert.run(s.id, volunteers[0].id, 'confirmed', now - 86_400_000, now - 86_400_000, null);
	}

	// A few messages so the message log isn't empty.
	const outbox = db.prepare(
		`INSERT INTO outbox (channel, recipient, subject, body_text, kind, status, attempts, send_after, sent_at, created_at)
		 VALUES (?, ?, ?, ?, ?, 'sent', 1, ?, ?, ?)`
	);
	const sample: [string, string, string, string][] = [
		['email', volunteers[3].email, 'You’re signed up: Setup crew', 'confirmation'],
		['email', volunteers[7].email, 'Reminder: Distribution line', 'reminder'],
		['sms', '+15550101009', '', 'reminder'],
		[
			'email',
			volunteers[11].email,
			'Your shifts with Riverside Community Food Bank',
			'portal_link'
		],
		['email', 'admin@example.org', 'Cover needed: Distribution line', 'alert']
	];
	sample.forEach(([channel, to, subject, kind], i) => {
		const t = now - (i + 1) * 47 * 60_000;
		outbox.run(channel, to, subject, `${subject || 'Reminder'} (demo message)`, kind, t, t, t);
	});

	console.info(
		`[shiftnest] Demo data loaded. Sign in at /login with admin@example.org / ${password}`
	);
	return true;
}
