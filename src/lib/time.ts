/**
 * Time zone aware date helpers built on Intl, shared by server and browser.
 * All instants are epoch milliseconds (UTC). Wall-clock values are strings in a named zone.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const formatters = new Map<string, Intl.DateTimeFormat>();

function dtf(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
	const key = `${locale}|${JSON.stringify(options)}`;
	let f = formatters.get(key);
	if (!f) {
		f = new Intl.DateTimeFormat(locale, options);
		formatters.set(key, f);
	}
	return f;
}

export function isValidTimeZone(tz: string): boolean {
	if (!tz) return false;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

export function isValidLocale(locale: string): boolean {
	try {
		return Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0;
	} catch {
		return false;
	}
}

interface WallParts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
	weekday: number;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function wallParts(ms: number, tz: string): WallParts {
	const parts = dtf('en-US', {
		timeZone: tz,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		weekday: 'short'
	}).formatToParts(new Date(ms));
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value ?? '0';
	return {
		year: Number(get('year')),
		month: Number(get('month')),
		day: Number(get('day')),
		hour: Number(get('hour')),
		minute: Number(get('minute')),
		second: Number(get('second')),
		weekday: WEEKDAYS[get('weekday')] ?? 0
	};
}

/** Offset of `tz` from UTC at the instant `ms`, in milliseconds (New York in July → -4h). */
export function tzOffset(ms: number, tz: string): number {
	const p = wallParts(ms, tz);
	const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
	return asUtc - Math.floor(ms / 1000) * 1000;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

export function isDateString(value: string): boolean {
	const m = DATE_RE.exec(value);
	if (!m) return false;
	const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
	return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function isTimeString(value: string): boolean {
	const m = TIME_RE.exec(value);
	return !!m && +m[1] < 24 && +m[2] < 60;
}

/**
 * Convert a wall-clock date and time in `tz` to a UTC instant.
 * Times that don't exist (DST spring-forward gap) move forward; ambiguous
 * times (fall-back overlap) resolve to the first occurrence.
 */
export function zonedToUtc(date: string, time: string, tz: string): number {
	const dm = DATE_RE.exec(date);
	const tm = TIME_RE.exec(time);
	if (!dm || !tm) throw new RangeError(`Invalid date/time: ${date} ${time}`);
	const wall = Date.UTC(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2]);
	const o1 = tzOffset(wall, tz);
	const t1 = wall - o1;
	const o2 = tzOffset(t1, tz);
	if (o1 === o2) return t1;
	const t2 = wall - o2;
	const o3 = tzOffset(t2, tz);
	if (o2 === o3) return t2;
	return Math.max(t1, t2);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Wall-clock date (`YYYY-MM-DD`) and time (`HH:MM`) of an instant in `tz`. */
export function utcToZoned(
	ms: number,
	tz: string
): { date: string; time: string; weekday: number } {
	const p = wallParts(ms, tz);
	return {
		date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
		time: `${pad(p.hour)}:${pad(p.minute)}`,
		weekday: p.weekday
	};
}

/** Calendar day key (`YYYY-MM-DD`) of an instant in `tz`. */
export function dayKey(ms: number, tz: string): string {
	return utcToZoned(ms, tz).date;
}

/** Add whole days to a `YYYY-MM-DD` string. */
export function addDays(date: string, days: number): string {
	const m = DATE_RE.exec(date);
	if (!m) throw new RangeError(`Invalid date: ${date}`);
	const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) + days * DAY);
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Start of the calendar day containing `ms` in `tz`, as a UTC instant. */
export function startOfDay(ms: number, tz: string): number {
	return zonedToUtc(dayKey(ms, tz), '00:00', tz);
}

export function formatDayLong(ms: number, tz: string, locale = 'en-US', withYear = false): string {
	return dtf(locale, {
		timeZone: tz,
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		...(withYear ? { year: 'numeric' } : {})
	}).format(ms);
}

export function formatDateShort(
	ms: number,
	tz: string,
	locale = 'en-US',
	withYear = false
): string {
	return dtf(locale, {
		timeZone: tz,
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		...(withYear ? { year: 'numeric' } : {})
	}).format(ms);
}

export function formatTime(ms: number, tz: string, locale = 'en-US'): string {
	return dtf(locale, { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(ms);
}

export function formatDateTime(ms: number, tz: string, locale = 'en-US'): string {
	return dtf(locale, {
		timeZone: tz,
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(ms);
}

/** "9:00 – 11:30 AM", or with dates when the range crosses midnight. */
export function formatTimeRange(start: number, end: number, tz: string, locale = 'en-US'): string {
	const sameDay = dayKey(start, tz) === dayKey(end, tz);
	const f = sameDay
		? dtf(locale, { timeZone: tz, hour: 'numeric', minute: '2-digit' })
		: dtf(locale, {
				timeZone: tz,
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit'
			});
	if (typeof f.formatRange === 'function') return f.formatRange(start, end);
	return `${f.format(start)} – ${f.format(end)}`;
}

/** "Sat, Nov 14 · 9:00 – 11:30 AM" */
export function formatShiftWhen(start: number, end: number, tz: string, locale = 'en-US'): string {
	return `${formatDateShort(start, tz, locale)} · ${formatTimeRange(start, end, tz, locale)}`;
}

/** Month/day/weekday pieces for a compact date badge. */
export function dateBadge(
	ms: number,
	tz: string,
	locale = 'en-US'
): { month: string; day: string; weekday: string } {
	return {
		month: dtf(locale, { timeZone: tz, month: 'short' }).format(ms),
		day: dtf(locale, { timeZone: tz, day: 'numeric' }).format(ms),
		weekday: dtf(locale, { timeZone: tz, weekday: 'short' }).format(ms)
	};
}

/** "Today", "Tomorrow", "In 3 days", "Yesterday"… based on calendar days in `tz`. */
export function relativeDay(ms: number, now: number, tz: string, locale = 'en-US'): string {
	const a = Date.parse(dayKey(ms, tz));
	const b = Date.parse(dayKey(now, tz));
	const days = Math.round((a - b) / DAY);
	const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
	if (Math.abs(days) < 7) {
		const s = rtf.format(days, 'day');
		return s.charAt(0).toUpperCase() + s.slice(1);
	}
	const weeks = Math.round(days / 7);
	const s = rtf.format(weeks, 'week');
	return s.charAt(0).toUpperCase() + s.slice(1);
}

export function durationHours(start: number, end: number): number {
	return (end - start) / HOUR;
}

/** "45 min", "2 h", "2.5 h" */
export function formatHours(hours: number): string {
	if (hours > 0 && hours < 1) return `${Math.round(hours * 60)} min`;
	const rounded = Math.round(hours * 100) / 100;
	return `${rounded.toLocaleString('en-US', { maximumFractionDigits: 2 })} h`;
}

/** A best-effort list of IANA zones for pickers. */
export function timeZones(): string[] {
	const withValues = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
	const zones = withValues.supportedValuesOf?.('timeZone') ?? [];
	return zones.includes('UTC') ? zones : ['UTC', ...zones];
}

export { HOUR, DAY };
