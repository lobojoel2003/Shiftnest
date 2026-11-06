import type { OrgSettings } from '../types';
import type { DB } from './db';

export const DEFAULT_SETTINGS: OrgSettings = {
	orgName: 'Our Volunteer Team',
	tagline: 'Pick a shift that works for you. Thank you for helping out!',
	contactEmail: '',
	timezone: 'UTC',
	locale: 'en-US',
	reminderHours: [24, 2],
	smsReminderHours: [2],
	cancelCutoffHours: 24,
	allowSelfCheckin: true,
	assumeAttendance: true,
	phoneCountryCode: '+1'
};

type Key = keyof OrgSettings;

export function getSettings(db: DB): OrgSettings {
	const rows = db.prepare('SELECT key, value FROM settings').all() as {
		key: string;
		value: string;
	}[];
	const settings: OrgSettings = structuredClone(DEFAULT_SETTINGS);
	const target = settings as unknown as Record<string, unknown>;
	for (const row of rows) {
		if (!(row.key in DEFAULT_SETTINGS)) continue;
		try {
			target[row.key] = JSON.parse(row.value);
		} catch {
			// Ignore corrupt values and keep the default.
		}
	}
	return settings;
}

export function updateSettings(db: DB, patch: Partial<OrgSettings>): OrgSettings {
	const upsert = db.prepare(
		'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
	);
	db.transaction(() => {
		for (const [key, value] of Object.entries(patch) as [Key, unknown][]) {
			if (!(key in DEFAULT_SETTINGS) || value === undefined) continue;
			upsert.run(key, JSON.stringify(value));
		}
	})();
	return getSettings(db);
}

/** Parse "24, 2" into [24, 2]: positive numbers, de-duplicated, largest first. */
export function parseHoursList(input: string, max = 24 * 14): number[] | null {
	const trimmed = input.trim();
	if (!trimmed) return [];
	const values = trimmed.split(/[\s,]+/).map(Number);
	if (values.some((v) => !Number.isFinite(v) || v <= 0 || v > max)) return null;
	return [...new Set(values.map((v) => Math.round(v * 4) / 4))].sort((a, b) => b - a).slice(0, 5);
}
