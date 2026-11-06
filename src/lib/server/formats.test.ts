import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';
import { renderEmail } from './email-layout';
import { buildCalendar, escapeText, foldLine, googleCalendarUrl, icsDate } from './ical';

describe('iCalendar', () => {
	it('escapes text per RFC 5545', () => {
		expect(escapeText('Pack; sort, lift\\carry\nline 2')).toBe(
			'Pack\\; sort\\, lift\\\\carry\\nline 2'
		);
	});

	it('folds long lines at 75 octets without splitting characters', () => {
		const folded = foldLine(`DESCRIPTION:${'é'.repeat(80)}`);
		for (const line of folded.split('\r\n')) {
			expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
		}
		expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'é'.repeat(80)}`);
	});

	it('writes a valid calendar with UTC times', () => {
		const start = Date.UTC(2026, 4, 2, 13, 0);
		const ics = buildCalendar({
			name: 'My shifts',
			refreshMinutes: 60,
			now: start,
			events: [
				{
					uid: 'signup-1@example.org',
					start,
					end: start + 7_200_000,
					summary: 'Sorting',
					location: '120 Main St, Springfield'
				}
			]
		});
		expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
		expect(ics).toContain('DTSTART:20260502T130000Z');
		expect(ics).toContain('DTEND:20260502T150000Z');
		expect(ics).toContain('LOCATION:120 Main St\\, Springfield');
		expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT60M');
		expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
		expect(icsDate(start)).toBe('20260502T130000Z');
	});

	it('builds Google Calendar links', () => {
		const url = new URL(googleCalendarUrl({ title: 'Sorting', start: 0, end: 3_600_000 }));
		expect(url.searchParams.get('dates')).toBe('19700101T000000Z/19700101T010000Z');
	});
});

describe('CSV', () => {
	it('quotes and neutralises formulas', () => {
		expect(csvCell('a,b')).toBe('"a,b"');
		expect(csvCell('say "hi"')).toBe('"say ""hi"""');
		expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
		expect(csvCell(-2.5)).toBe('-2.5');
		expect(csvCell(null)).toBe('');
		expect(toCsv(['a'], [[1]])).toBe('﻿a\r\n1\r\n');
	});
});

describe('email layout', () => {
	it('renders text and escaped HTML', () => {
		const { text, html } = renderEmail('Food <Bank>', 'Hi', {
			greeting: 'Hi Ana,',
			intro: ['Thanks!'],
			details: [['When', 'Saturday']],
			actions: [{ label: 'Manage', url: 'https://example.org/v/abc' }]
		});
		expect(text).toContain('When: Saturday');
		expect(text).toContain('Manage: https://example.org/v/abc');
		expect(html).toContain('Food &lt;Bank&gt;');
		expect(html).not.toContain('<Bank>');
	});
});
