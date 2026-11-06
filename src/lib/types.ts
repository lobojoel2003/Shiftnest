/** Types shared between server and browser code. Keep this file free of server imports. */

export type Role = 'owner' | 'coordinator';
export type EventStatus = 'draft' | 'published' | 'archived';
export type SignupStatus = 'confirmed' | 'attended' | 'no_show' | 'cancelled';
export type CancelReason = 'volunteer' | 'coordinator' | 'moved' | 'swapped' | 'shift_deleted';

export interface SessionUser {
	id: number;
	email: string;
	name: string;
	role: Role;
}

export interface SessionVolunteer {
	id: number;
	name: string;
	email: string;
}

export interface OrgSettings {
	orgName: string;
	tagline: string;
	contactEmail: string;
	timezone: string;
	locale: string;
	/** Hours before a shift to send email reminders, largest first. */
	reminderHours: number[];
	/** Hours before a shift to send text reminders (only if SMS is configured). */
	smsReminderHours: number[];
	/** Volunteers can't cancel or switch inside this many hours of the start. 0 = any time. */
	cancelCutoffHours: number;
	/** Let volunteers mark themselves as checked in from their phone. */
	allowSelfCheckin: boolean;
	/** Count past shifts nobody marked as attended or no-show as worked. */
	assumeAttendance: boolean;
	/** Country calling code used when a volunteer types a local phone number. */
	phoneCountryCode: string;
}

export interface BuildInfo {
	version: string;
	buildNumber: string;
	commit: string;
	date: string;
}

export interface Flash {
	type: 'success' | 'error' | 'info';
	message: string;
}
