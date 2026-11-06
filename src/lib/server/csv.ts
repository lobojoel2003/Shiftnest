/** CSV writer with spreadsheet formula-injection protection. */

export function csvCell(value: unknown): string {
	if (value === null || value === undefined) return '';
	let s = typeof value === 'number' ? String(Math.round(value * 100) / 100) : String(value);
	// Cells starting with these characters can run as formulas in Excel/Sheets.
	if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
	return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
	// Leading BOM so Excel detects UTF-8.
	return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function csvResponse(body: string, filename: string): Response {
	return new Response(body, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${filename}"`,
			'cache-control': 'no-store'
		}
	});
}
