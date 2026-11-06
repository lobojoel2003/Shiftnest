import { describe, expect, it } from 'vitest';
import {
	addDays,
	dayKey,
	formatHours,
	formatTimeRange,
	isDateString,
	isTimeString,
	relativeDay,
	tzOffset,
	utcToZoned,
	zonedToUtc
} from './time';

describe('zonedToUtc', () => {
	it('converts wall-clock times in a zone to UTC', () => {
		expect(new Date(zonedToUtc('2026-07-04', '09:00', 'America/New_York')).toISOString()).toBe(
			'2026-07-04T13:00:00.000Z'
		);
		expect(new Date(zonedToUtc('2026-01-15', '09:00', 'Europe/London')).toISOString()).toBe(
			'2026-01-15T09:00:00.000Z'
		);
		expect(new Date(zonedToUtc('2026-01-15', '09:30', 'Asia/Kolkata')).toISOString()).toBe(
			'2026-01-15T04:00:00.000Z'
		);
	});

	it('moves times in a spring-forward gap forward', () => {
		// 02:30 doesn't exist in New York on 2026-03-08.
		expect(new Date(zonedToUtc('2026-03-08', '02:30', 'America/New_York')).toISOString()).toBe(
			'2026-03-08T07:30:00.000Z'
		);
	});

	it('resolves fall-back overlaps to the first occurrence', () => {
		expect(new Date(zonedToUtc('2026-11-01', '01:30', 'America/New_York')).toISOString()).toBe(
			'2026-11-01T05:30:00.000Z'
		);
	});

	it('round-trips through utcToZoned', () => {
		const ms = zonedToUtc('2026-10-25', '18:45', 'Australia/Sydney');
		expect(utcToZoned(ms, 'Australia/Sydney')).toMatchObject({ date: '2026-10-25', time: '18:45' });
	});

	it('rejects malformed input', () => {
		expect(() => zonedToUtc('2026-13-01', 'x', 'UTC')).toThrow(RangeError);
	});
});

describe('helpers', () => {
	it('computes offsets', () => {
		expect(tzOffset(Date.UTC(2026, 6, 1), 'America/New_York')).toBe(-4 * 3_600_000);
		expect(tzOffset(Date.UTC(2026, 0, 1), 'America/New_York')).toBe(-5 * 3_600_000);
	});

	it('validates date and time strings', () => {
		expect(isDateString('2026-02-28')).toBe(true);
		expect(isDateString('2026-02-30')).toBe(false);
		expect(isTimeString('23:59')).toBe(true);
		expect(isTimeString('24:00')).toBe(false);
	});

	it('adds days across month and DST boundaries', () => {
		expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
		expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
	});

	it('groups by local calendar day', () => {
		// 03:00 UTC is still the previous evening in Los Angeles.
		expect(dayKey(Date.UTC(2026, 4, 2, 3), 'America/Los_Angeles')).toBe('2026-05-01');
	});

	it('formats ranges and durations', () => {
		const start = zonedToUtc('2026-05-02', '09:00', 'UTC');
		expect(formatTimeRange(start, start + 2.5 * 3_600_000, 'UTC')).toMatch(/9:00.*11:30/);
		expect(formatHours(2.5)).toBe('2.5 h');
		expect(formatHours(0.75)).toBe('45 min');
	});

	it('describes relative days', () => {
		const now = Date.UTC(2026, 4, 1, 12);
		expect(relativeDay(now + 86_400_000, now, 'UTC')).toBe('Tomorrow');
		expect(relativeDay(now, now, 'UTC')).toBe('Today');
	});
});
