/**
 * Minimal RFC 5545 (iCalendar) writer. Times are written in UTC so no
 * VTIMEZONE blocks are needed; calendar apps show them in local time.
 */

export interface IcsEvent {
	uid: string;
	start: number;
	end: number;
	summary: string;
	description?: string;
	location?: string;
	url?: string;
	status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
	sequence?: number;
	lastModified?: number;
	created?: number;
}

export interface IcsCalendar {
	name: string;
	description?: string;
	events: IcsEvent[];
	/** Hint for how often subscribers should refresh. */
	refreshMinutes?: number;
	now?: number;
}

const PRODID = '-//Shiftnest//Volunteer Shifts//EN';

export function icsDate(ms: number): string {
	return new Date(ms)
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
}

export function escapeText(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r\n|\r|\n/g, '\\n');
}

/** Fold a content line at 75 octets, without splitting UTF-8 sequences. */
export function foldLine(line: string): string {
	const encoder = new TextEncoder();
	if (encoder.encode(line).length <= 75) return line;
	const parts: string[] = [];
	let current = '';
	let currentBytes = 0;
	let limit = 75;
	for (const char of line) {
		const bytes = encoder.encode(char).length;
		if (currentBytes + bytes > limit) {
			parts.push(current);
			current = '';
			currentBytes = 0;
			limit = 74; // continuation lines start with a space
		}
		current += char;
		currentBytes += bytes;
	}
	parts.push(current);
	return parts.join('\r\n ');
}

export function buildCalendar(calendar: IcsCalendar): string {
	const now = calendar.now ?? Date.now();
	const lines: string[] = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		`PRODID:${PRODID}`,
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText(calendar.name)}`
	];
	if (calendar.description) lines.push(`X-WR-CALDESC:${escapeText(calendar.description)}`);
	if (calendar.refreshMinutes) {
		lines.push(`REFRESH-INTERVAL;VALUE=DURATION:PT${calendar.refreshMinutes}M`);
		lines.push(`X-PUBLISHED-TTL:PT${calendar.refreshMinutes}M`);
	}
	for (const e of calendar.events) {
		lines.push(
			'BEGIN:VEVENT',
			`UID:${e.uid}`,
			`DTSTAMP:${icsDate(now)}`,
			`DTSTART:${icsDate(e.start)}`,
			`DTEND:${icsDate(e.end)}`,
			`SUMMARY:${escapeText(e.summary)}`
		);
		if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
		if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
		if (e.url) lines.push(`URL:${e.url}`);
		if (e.created) lines.push(`CREATED:${icsDate(e.created)}`);
		if (e.lastModified) lines.push(`LAST-MODIFIED:${icsDate(e.lastModified)}`);
		lines.push(`SEQUENCE:${e.sequence ?? 0}`);
		lines.push(`STATUS:${e.status ?? 'CONFIRMED'}`);
		lines.push('TRANSP:OPAQUE', 'END:VEVENT');
	}
	lines.push('END:VCALENDAR');
	return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function icsResponse(body: string, filename: string, download = false): Response {
	return new Response(body, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
			'cache-control': 'private, max-age=300'
		}
	});
}

/** "Add to Google Calendar" link for a single shift. */
export function googleCalendarUrl(e: {
	title: string;
	start: number;
	end: number;
	details?: string;
	location?: string;
}): string {
	const params = new URLSearchParams({
		action: 'TEMPLATE',
		text: e.title,
		dates: `${icsDate(e.start)}/${icsDate(e.end)}`
	});
	if (e.details) params.set('details', e.details);
	if (e.location) params.set('location', e.location);
	return `https://calendar.google.com/calendar/render?${params}`;
}
