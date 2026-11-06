import type { EventStatus } from '../types';
import { addDays, isDateString, isTimeString, zonedToUtc } from '../time';
import type { ShiftDetails, ShiftTimes } from './shifts';
import { int, longText, text } from './validation';

export interface EventValues {
	title: string;
	summary: string;
	description: string;
	location: string;
	status: EventStatus;
}

export function readEventForm(data: FormData): {
	values: EventValues;
	errors: Partial<Record<keyof EventValues, string>>;
} {
	const status = text(data, 'status', 20) as EventStatus;
	const values: EventValues = {
		title: text(data, 'title', 120),
		summary: text(data, 'summary', 200),
		description: longText(data, 'description', 5000),
		location: text(data, 'location', 200),
		status: ['draft', 'published', 'archived'].includes(status) ? status : 'draft'
	};
	const errors: Partial<Record<keyof EventValues, string>> = {};
	if (!values.title) errors.title = 'Give the event a name.';
	return { values, errors };
}

export interface ShiftValues {
	role: string;
	date: string;
	start: string;
	end: string;
	capacity: string;
	location: string;
	notes: string;
	repeat: string;
	count: string;
}

export type ShiftErrors = Partial<Record<keyof ShiftValues, string>>;

export const REPEAT_STEP: Record<string, number> = { none: 0, daily: 1, weekly: 7, biweekly: 14 };

/** Wall-clock start/end on `date` in `tz`. An end at or before the start rolls into the next day. */
export function shiftTimes(date: string, start: string, end: string, tz: string): ShiftTimes {
	const startsAt = zonedToUtc(date, start, tz);
	const endDate = end <= start ? addDays(date, 1) : date;
	return { startsAt, endsAt: zonedToUtc(endDate, end, tz) };
}

/** Occurrence times for a repeating shift, keeping the same local time across DST changes. */
export function repeatTimes(
	date: string,
	start: string,
	end: string,
	tz: string,
	repeat: string,
	count: number
): ShiftTimes[] {
	const step = REPEAT_STEP[repeat] ?? 0;
	const n = step === 0 ? 1 : Math.max(1, Math.min(52, count));
	return Array.from({ length: n }, (_, i) => shiftTimes(addDays(date, i * step), start, end, tz));
}

export function readShiftForm(
	data: FormData,
	tz: string
): { values: ShiftValues; errors: ShiftErrors; details?: ShiftDetails; times?: ShiftTimes[] } {
	const values: ShiftValues = {
		role: text(data, 'role', 80),
		date: text(data, 'date', 10),
		start: text(data, 'start', 5),
		end: text(data, 'end', 5),
		capacity: text(data, 'capacity', 4),
		location: text(data, 'location', 200),
		notes: longText(data, 'notes', 500),
		repeat: text(data, 'repeat', 10) || 'none',
		count: text(data, 'count', 3) || '1'
	};
	const errors: ShiftErrors = {};
	if (!values.role) errors.role = 'Name the role, like “Sorting” or “Driver”.';
	if (!isDateString(values.date)) errors.date = 'Pick a date.';
	if (!isTimeString(values.start)) errors.start = 'Pick a start time.';
	if (!isTimeString(values.end)) errors.end = 'Pick an end time.';
	const capacity = int(data, 'capacity');
	if (capacity === null || capacity < 1 || capacity > 500) errors.capacity = 'Between 1 and 500.';
	const count = int(data, 'count') ?? 1;
	if (!(values.repeat in REPEAT_STEP)) errors.repeat = 'Pick how often it repeats.';
	else if (values.repeat !== 'none' && (count < 2 || count > 52))
		errors.count = 'Between 2 and 52.';
	if (Object.keys(errors).length) return { values, errors };

	return {
		values,
		errors,
		details: {
			role: values.role,
			capacity: capacity!,
			location: values.location,
			notes: values.notes
		},
		times: repeatTimes(values.date, values.start, values.end, tz, values.repeat, count)
	};
}
