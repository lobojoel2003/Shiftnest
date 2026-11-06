import { describe, expect, it } from 'vitest';
import { readShiftForm, repeatTimes, shiftTimes } from './forms';

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [k, v] of Object.entries(fields)) data.set(k, v);
	return data;
}

describe('shift forms', () => {
	it('rolls overnight shifts into the next day', () => {
		const t = shiftTimes('2026-05-01', '22:00', '02:00', 'UTC');
		expect(t.endsAt - t.startsAt).toBe(4 * 3_600_000);
	});

	it('keeps local time when a weekly repeat crosses a DST change', () => {
		const times = repeatTimes('2026-03-01', '09:00', '11:00', 'America/New_York', 'weekly', 2);
		expect(new Date(times[0].startsAt).toISOString()).toBe('2026-03-01T14:00:00.000Z');
		expect(new Date(times[1].startsAt).toISOString()).toBe('2026-03-08T13:00:00.000Z');
	});

	it('validates and parses a repeating shift', () => {
		const ok = readShiftForm(
			form({
				role: 'Sorting',
				date: '2026-05-01',
				start: '09:00',
				end: '12:00',
				capacity: '4',
				repeat: 'daily',
				count: '3'
			}),
			'UTC'
		);
		expect(ok.errors).toEqual({});
		expect(ok.times).toHaveLength(3);
		expect(ok.details).toMatchObject({ role: 'Sorting', capacity: 4 });

		const bad = readShiftForm(
			form({
				role: '',
				date: 'x',
				start: '9',
				end: '',
				capacity: '0',
				repeat: 'weekly',
				count: '1'
			}),
			'UTC'
		);
		expect(Object.keys(bad.errors).sort()).toEqual([
			'capacity',
			'count',
			'date',
			'end',
			'role',
			'start'
		]);
	});
});
