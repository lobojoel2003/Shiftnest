import {
	dateBadge,
	formatDateShort,
	formatDateTime,
	formatDayLong,
	formatHours,
	formatShiftWhen,
	formatTime,
	formatTimeRange,
	relativeDay
} from './time.ts';

/** Date formatting bound to the organisation's time zone and locale. */
export function formatter(org: { timezone: string; locale: string }) {
	const { timezone: tz, locale } = org;
	return {
		day: (ms: number, withYear = false) => formatDayLong(ms, tz, locale, withYear),
		date: (ms: number, withYear = false) => formatDateShort(ms, tz, locale, withYear),
		time: (ms: number) => formatTime(ms, tz, locale),
		range: (start: number, end: number) => formatTimeRange(start, end, tz, locale),
		when: (start: number, end: number) => formatShiftWhen(start, end, tz, locale),
		dateTime: (ms: number) => formatDateTime(ms, tz, locale),
		badge: (ms: number) => dateBadge(ms, tz, locale),
		relative: (ms: number, now = Date.now()) => relativeDay(ms, now, tz, locale),
		hours: formatHours
	};
}

export type Formatter = ReturnType<typeof formatter>;

export function initials(name: string): string {
	const parts = name.trim().split(/\s+/);
	return (
		(parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
	).toUpperCase();
}

export function plural(n: number, one: string, many = `${one}s`): string {
	return `${n} ${n === 1 ? one : many}`;
}
