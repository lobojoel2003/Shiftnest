import type { DB } from './db';

/**
 * SQL expression for the hours a sign-up counts for.
 * Attended shifts always count; past shifts nobody marked count too when the
 * organisation assumes attendance. Needs `@now` and `@assume` parameters.
 */
export function completedHoursSql(su = 'su', sh = 'sh'): string {
	return `(CASE
		WHEN ${su}.status = 'attended'
			THEN COALESCE(${su}.hours, (${sh}.ends_at - ${sh}.starts_at) / 3600000.0)
		WHEN ${su}.status = 'confirmed' AND @assume = 1 AND ${sh}.ends_at <= @now
			THEN COALESCE(${su}.hours, (${sh}.ends_at - ${sh}.starts_at) / 3600000.0)
		ELSE 0 END)`;
}

export interface HoursRange {
	from: number;
	to: number;
	assumeAttendance: boolean;
	now?: number;
}

function params(range: HoursRange) {
	return {
		from: range.from,
		to: range.to,
		now: range.now ?? Date.now(),
		assume: range.assumeAttendance ? 1 : 0
	};
}

export interface VolunteerHours {
	volunteer_id: number;
	name: string;
	email: string;
	shifts: number;
	hours: number;
}

export function hoursByVolunteer(db: DB, range: HoursRange): VolunteerHours[] {
	return db
		.prepare(
			`SELECT v.id AS volunteer_id, v.name, v.email,
				SUM(CASE WHEN ${completedHoursSql()} > 0 THEN 1 ELSE 0 END) AS shifts,
				SUM(${completedHoursSql()}) AS hours
			 FROM signups su
			 JOIN shifts sh ON sh.id = su.shift_id
			 JOIN volunteers v ON v.id = su.volunteer_id
			 WHERE sh.starts_at >= @from AND sh.starts_at < @to
			 GROUP BY v.id
			 HAVING SUM(${completedHoursSql()}) > 0
			 ORDER BY hours DESC, v.name COLLATE NOCASE`
		)
		.all(params(range)) as VolunteerHours[];
}

export interface EventHours {
	event_id: number;
	title: string;
	shifts: number;
	volunteers: number;
	hours: number;
}

export function hoursByEvent(db: DB, range: HoursRange): EventHours[] {
	return db
		.prepare(
			`SELECT e.id AS event_id, e.title,
				SUM(CASE WHEN ${completedHoursSql()} > 0 THEN 1 ELSE 0 END) AS shifts,
				COUNT(DISTINCT CASE WHEN ${completedHoursSql()} > 0 THEN su.volunteer_id END) AS volunteers,
				SUM(${completedHoursSql()}) AS hours
			 FROM signups su
			 JOIN shifts sh ON sh.id = su.shift_id
			 JOIN events e ON e.id = sh.event_id
			 WHERE sh.starts_at >= @from AND sh.starts_at < @to
			 GROUP BY e.id
			 HAVING SUM(${completedHoursSql()}) > 0
			 ORDER BY hours DESC`
		)
		.all(params(range)) as EventHours[];
}

export interface HoursEntry {
	signup_id: number;
	starts_at: number;
	ends_at: number;
	event_title: string;
	role: string;
	volunteer_name: string;
	volunteer_email: string;
	status: string;
	hours: number;
}

/** Every counted sign-up in the range, for CSV export. */
export function hoursEntries(db: DB, range: HoursRange): HoursEntry[] {
	return db
		.prepare(
			`SELECT su.id AS signup_id, sh.starts_at, sh.ends_at, e.title AS event_title, sh.role,
				v.name AS volunteer_name, v.email AS volunteer_email, su.status,
				${completedHoursSql()} AS hours
			 FROM signups su
			 JOIN shifts sh ON sh.id = su.shift_id
			 JOIN events e ON e.id = sh.event_id
			 JOIN volunteers v ON v.id = su.volunteer_id
			 WHERE sh.starts_at >= @from AND sh.starts_at < @to AND ${completedHoursSql()} > 0
			 ORDER BY sh.starts_at, v.name COLLATE NOCASE`
		)
		.all(params(range)) as HoursEntry[];
}

export function totalHours(db: DB, range: HoursRange): { hours: number; shifts: number } {
	const row = db
		.prepare(
			`SELECT COALESCE(SUM(${completedHoursSql()}), 0) AS hours,
				COALESCE(SUM(CASE WHEN ${completedHoursSql()} > 0 THEN 1 ELSE 0 END), 0) AS shifts
			 FROM signups su JOIN shifts sh ON sh.id = su.shift_id
			 WHERE sh.starts_at >= @from AND sh.starts_at < @to`
		)
		.get(params(range)) as { hours: number; shifts: number };
	return row;
}

/** Lifetime hours for one volunteer. */
export function volunteerTotalHours(
	db: DB,
	volunteerId: number,
	assumeAttendance: boolean,
	now = Date.now()
): { hours: number; shifts: number } {
	return db
		.prepare(
			`SELECT COALESCE(SUM(${completedHoursSql()}), 0) AS hours,
				COALESCE(SUM(CASE WHEN ${completedHoursSql()} > 0 THEN 1 ELSE 0 END), 0) AS shifts
			 FROM signups su JOIN shifts sh ON sh.id = su.shift_id
			 WHERE su.volunteer_id = @volunteerId`
		)
		.get({ volunteerId, now, assume: assumeAttendance ? 1 : 0 }) as {
		hours: number;
		shifts: number;
	};
}
