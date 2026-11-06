import { formatDayLong, formatTimeRange } from '../time';
import type { OrgSettings } from '../types';
import { config } from './config';
import type { DB } from './db';
import { renderEmail, type EmailParts } from './email-layout';
import { queueEmail, queueSms } from './outbox';
import { getSettings } from './settings';
import type { SignupDetail } from './signups';
import { alertRecipients, type UserRow } from './users';
import type { VolunteerRow } from './volunteers';

/** Everything templates need about a shift. Satisfied by SignupDetail. */
export interface ShiftInfo {
	shift_id: number;
	role: string;
	starts_at: number;
	ends_at: number;
	shift_location: string;
	shift_notes: string;
	event_slug: string;
	event_title: string;
	event_location: string;
}

interface Recipient {
	name: string;
	email: string;
	manage_token: string;
}

function origin(): string {
	return config().origin;
}

export const links = {
	portal: (token: string) => `${origin()}/v/${token}`,
	event: (slug: string) => `${origin()}/events/${slug}`,
	shiftIcs: (shiftId: number) => `${origin()}/ical/shifts/${shiftId}.ics`,
	swap: (token: string) => `${origin()}/swap/${token}`,
	adminShift: (shiftId: number) => `${origin()}/admin/shifts/${shiftId}`,
	login: () => `${origin()}/login`,
	invite: (token: string) => `${origin()}/invite/${token}`,
	reset: (token: string) => `${origin()}/reset/${token}`
};

function firstName(name: string): string {
	return name.trim().split(/\s+/)[0] || name;
}

export function shiftWhen(s: ShiftInfo, settings: OrgSettings): string {
	return `${formatDayLong(s.starts_at, settings.timezone, settings.locale)}, ${formatTimeRange(
		s.starts_at,
		s.ends_at,
		settings.timezone,
		settings.locale
	)}`;
}

function shiftDetails(s: ShiftInfo, settings: OrgSettings): [string, string][] {
	const rows: [string, string][] = [
		['What', `${s.role} · ${s.event_title}`],
		['When', shiftWhen(s, settings)]
	];
	const where = s.shift_location || s.event_location;
	if (where) rows.push(['Where', where]);
	if (s.shift_notes) rows.push(['Notes', s.shift_notes]);
	return rows;
}

function send(
	db: DB,
	settings: OrgSettings,
	to: string,
	subject: string,
	kind: string,
	parts: EmailParts
): void {
	const { text, html } = renderEmail(settings.orgName, subject, parts);
	queueEmail(db, { to, subject, text, html, kind });
}

function contactLine(settings: OrgSettings): string[] {
	return settings.contactEmail
		? [`Questions? Reply to this email or write to ${settings.contactEmail}.`]
		: [];
}

function alertCoordinators(
	db: DB,
	settings: OrgSettings,
	subject: string,
	kind: string,
	parts: (user: UserRow) => EmailParts
): void {
	for (const user of alertRecipients(db))
		send(db, settings, user.email, subject, kind, parts(user));
}

// --- Volunteer messages ----------------------------------------------------------------

export function notifySignupConfirmed(db: DB, s: SignupDetail, settings = getSettings(db)): void {
	const policy =
		settings.cancelCutoffHours > 0
			? `Plans change, and that’s okay. You can switch or cancel up to ${settings.cancelCutoffHours} hours before the shift, or ask someone to cover it any time.`
			: 'Plans change, and that’s okay. You can switch, cancel, or ask someone to cover your shift from your personal page.';
	send(
		db,
		settings,
		s.volunteer_email,
		`You’re signed up: ${s.role}, ${shiftWhen(s, settings)}`,
		'confirmation',
		{
			greeting: `Hi ${firstName(s.volunteer_name)},`,
			intro: [`Thank you for signing up with ${settings.orgName}! Here are the details:`],
			details: shiftDetails(s, settings),
			actions: [
				{ label: 'Manage my shifts', url: links.portal(s.volunteer_manage_token) },
				{ label: 'Add to calendar', url: links.shiftIcs(s.shift_id) }
			],
			outro: [
				reminderLine(settings),
				policy,
				'Keep this email: the “Manage my shifts” button is your personal link.',
				...contactLine(settings)
			].filter(Boolean)
		}
	);
}

function reminderLine(settings: OrgSettings): string {
	const hours = settings.reminderHours;
	if (!hours.length) return '';
	const describe = (h: number) =>
		h >= 24 && h % 24 === 0
			? `${h / 24} day${h === 24 ? '' : 's'}`
			: `${h} hour${h === 1 ? '' : 's'}`;
	return `We’ll send you a reminder ${hours.map(describe).join(' and ')} before it starts.`;
}

export function notifyReminder(
	db: DB,
	s: SignupDetail,
	channel: 'email' | 'sms',
	settings = getSettings(db)
): void {
	if (channel === 'sms') {
		const where = s.shift_location || s.event_location;
		queueSms(db, {
			to: s.volunteer_phone,
			kind: 'reminder',
			text: `${settings.orgName}: reminder, you’re on ${s.role} ${shiftWhen(s, settings)}${where ? ` at ${where}` : ''}. Manage: ${links.portal(s.volunteer_manage_token)} Reply STOP to opt out.`
		});
		return;
	}
	send(
		db,
		settings,
		s.volunteer_email,
		`Reminder: ${s.role}, ${shiftWhen(s, settings)}`,
		'reminder',
		{
			greeting: `Hi ${firstName(s.volunteer_name)},`,
			intro: [`A friendly reminder about your upcoming shift with ${settings.orgName}.`],
			details: shiftDetails(s, settings),
			actions: [
				{ label: 'View my shifts', url: links.portal(s.volunteer_manage_token) },
				{ label: 'Add to calendar', url: links.shiftIcs(s.shift_id) }
			],
			outro: [
				'Can’t make it anymore? Open your shifts and choose “Find cover” so someone else can take it.',
				'See you there, and thank you!'
			]
		}
	);
}

export function notifyCancelled(db: DB, s: SignupDetail, settings = getSettings(db)): void {
	send(
		db,
		settings,
		s.volunteer_email,
		`Cancelled: ${s.role}, ${shiftWhen(s, settings)}`,
		'cancellation',
		{
			greeting: `Hi ${firstName(s.volunteer_name)},`,
			intro: ['You’ve been removed from this shift. No action needed.'],
			details: shiftDetails(s, settings),
			actions: [
				{ label: 'Find another shift', url: links.event(s.event_slug) },
				{ label: 'My shifts', url: links.portal(s.volunteer_manage_token), primary: false }
			],
			outro: ['Thanks for letting us know.']
		}
	);
	alertCoordinators(
		db,
		settings,
		`${s.volunteer_name} cancelled ${s.role}, ${shiftWhen(s, settings)}`,
		'alert',
		(u) => ({
			greeting: `Hi ${firstName(u.name)},`,
			intro: [`${s.volunteer_name} (${s.volunteer_email}) cancelled their sign-up.`],
			details: shiftDetails(s, settings),
			actions: [{ label: 'Open roster', url: links.adminShift(s.shift_id) }]
		})
	);
}

export function notifyRemovedByCoordinator(
	db: DB,
	s: SignupDetail,
	settings = getSettings(db)
): void {
	send(
		db,
		settings,
		s.volunteer_email,
		`Update: you’re no longer on ${s.role}, ${shiftWhen(s, settings)}`,
		'removed',
		{
			greeting: `Hi ${firstName(s.volunteer_name)},`,
			intro: [`A coordinator at ${settings.orgName} removed you from this shift.`],
			details: shiftDetails(s, settings),
			actions: [
				{ label: 'Find another shift', url: links.event(s.event_slug) },
				{ label: 'My shifts', url: links.portal(s.volunteer_manage_token), primary: false }
			],
			outro: contactLine(settings)
		}
	);
}

export function notifyMoved(
	db: DB,
	from: SignupDetail,
	to: SignupDetail,
	settings = getSettings(db)
): void {
	send(
		db,
		settings,
		to.volunteer_email,
		`Switched: you’re now on ${to.role}, ${shiftWhen(to, settings)}`,
		'confirmation',
		{
			greeting: `Hi ${firstName(to.volunteer_name)},`,
			intro: [`Done! You switched from ${from.role} (${shiftWhen(from, settings)}) to this shift:`],
			details: shiftDetails(to, settings),
			actions: [
				{ label: 'Manage my shifts', url: links.portal(to.volunteer_manage_token) },
				{ label: 'Add to calendar', url: links.shiftIcs(to.shift_id) }
			]
		}
	);
}

export function notifyShiftChanged(
	db: DB,
	signups: SignupDetail[],
	changes: { timeChanged: boolean; locationChanged: boolean },
	settings = getSettings(db)
): void {
	const what = [changes.timeChanged && 'time', changes.locationChanged && 'location']
		.filter(Boolean)
		.join(' and ');
	for (const s of signups) {
		send(
			db,
			settings,
			s.volunteer_email,
			`Updated ${what}: ${s.role}, ${shiftWhen(s, settings)}`,
			'update',
			{
				greeting: `Hi ${firstName(s.volunteer_name)},`,
				intro: [`Heads up: the ${what} of your shift changed. Here are the new details:`],
				details: shiftDetails(s, settings),
				actions: [
					{ label: 'Manage my shifts', url: links.portal(s.volunteer_manage_token) },
					{ label: 'Add to calendar', url: links.shiftIcs(s.shift_id) }
				],
				outro: [
					'If the new time doesn’t work for you, you can switch, cancel, or find cover from your shifts page.'
				]
			}
		);
	}
}

export function notifyShiftDeleted(
	db: DB,
	signups: SignupDetail[],
	settings = getSettings(db)
): void {
	for (const s of signups) {
		send(
			db,
			settings,
			s.volunteer_email,
			`Cancelled: ${s.role}, ${shiftWhen(s, settings)}`,
			'removed',
			{
				greeting: `Hi ${firstName(s.volunteer_name)},`,
				intro: [`${settings.orgName} cancelled this shift, so you don’t need to come in.`],
				details: shiftDetails(s, settings),
				actions: [{ label: 'See other shifts', url: links.event(s.event_slug) }],
				outro: ['Thank you for being willing to help.', ...contactLine(settings)]
			}
		);
	}
}

export function notifyCoverRequested(
	db: DB,
	s: SignupDetail,
	token: string,
	settings = getSettings(db)
): void {
	send(
		db,
		settings,
		s.volunteer_email,
		`Looking for cover: ${s.role}, ${shiftWhen(s, settings)}`,
		'swap',
		{
			greeting: `Hi ${firstName(s.volunteer_name)},`,
			intro: [
				'Your shift is now listed as needing cover. You’re still on the schedule until someone takes it, and we’ll email you the moment they do.',
				'Know someone who could do it? Send them this link:'
			],
			details: shiftDetails(s, settings),
			actions: [
				{ label: 'Share the cover link', url: links.swap(token) },
				{ label: 'My shifts', url: links.portal(s.volunteer_manage_token), primary: false }
			]
		}
	);
	alertCoordinators(
		db,
		settings,
		`Cover needed: ${s.role}, ${shiftWhen(s, settings)}`,
		'alert',
		(u) => ({
			greeting: `Hi ${firstName(u.name)},`,
			intro: [`${s.volunteer_name} is looking for someone to cover their shift.`],
			details: shiftDetails(s, settings),
			actions: [
				{ label: 'Open roster', url: links.adminShift(s.shift_id) },
				{ label: 'Cover link', url: links.swap(token), primary: false }
			]
		})
	);
}

export function notifyCoverTaken(
	db: DB,
	original: SignupDetail,
	taker: SignupDetail,
	settings = getSettings(db)
): void {
	send(
		db,
		settings,
		original.volunteer_email,
		`Covered! ${taker.volunteer_name} is taking your shift`,
		'swap',
		{
			greeting: `Hi ${firstName(original.volunteer_name)},`,
			intro: [`Good news: ${taker.volunteer_name} took over your shift, so you’re free.`],
			details: shiftDetails(original, settings),
			actions: [{ label: 'My shifts', url: links.portal(original.volunteer_manage_token) }]
		}
	);
	notifySignupConfirmed(db, taker, settings);
	alertCoordinators(
		db,
		settings,
		`Swap: ${taker.volunteer_name} covered ${original.role}`,
		'alert',
		(u) => ({
			greeting: `Hi ${firstName(u.name)},`,
			intro: [
				`${taker.volunteer_name} (${taker.volunteer_email}) took over from ${original.volunteer_name}.`
			],
			details: shiftDetails(original, settings),
			actions: [{ label: 'Open roster', url: links.adminShift(original.shift_id) }]
		})
	);
}

export function sendPortalLink(db: DB, v: Recipient, settings = getSettings(db)): void {
	send(db, settings, v.email, `Your shifts with ${settings.orgName}`, 'portal_link', {
		greeting: `Hi ${firstName(v.name)},`,
		intro: ['Here’s your personal link to see, switch, or cancel your shifts. No password needed.'],
		actions: [{ label: 'Open my shifts', url: links.portal(v.manage_token) }],
		outro: [
			'Don’t forward this email: anyone with the link can manage your shifts.',
			'If you didn’t ask for this, you can ignore it.'
		]
	});
}

export function sendBroadcast(
	db: DB,
	recipients: (Recipient | VolunteerRow)[],
	subject: string,
	body: string,
	fromName: string,
	settings = getSettings(db)
): number {
	const seen = new Set<string>();
	for (const r of recipients) {
		const key = r.email.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		send(db, settings, r.email, subject, 'broadcast', {
			greeting: `Hi ${firstName(r.name)},`,
			intro: body
				.split(/\n{2,}/)
				.map((p) => p.trim())
				.filter(Boolean),
			actions: [{ label: 'My shifts', url: links.portal(r.manage_token) }],
			outro: [`${fromName}, ${settings.orgName}`]
		});
	}
	return seen.size;
}

// --- Coordinator account messages ------------------------------------------------------

export function sendInvite(
	db: DB,
	user: UserRow,
	token: string,
	invitedBy: string,
	settings = getSettings(db)
): void {
	send(
		db,
		settings,
		user.email,
		`${invitedBy} invited you to coordinate volunteers for ${settings.orgName}`,
		'invite',
		{
			greeting: `Hi ${firstName(user.name)},`,
			intro: [
				`${invitedBy} added you as a coordinator for ${settings.orgName} on Shiftnest. Choose a password to get started.`
			],
			actions: [{ label: 'Accept invitation', url: links.invite(token) }],
			outro: ['This link works for 7 days.']
		}
	);
}

export function sendPasswordReset(
	db: DB,
	user: UserRow,
	token: string,
	settings = getSettings(db)
): void {
	send(db, settings, user.email, 'Reset your Shiftnest password', 'password_reset', {
		greeting: `Hi ${firstName(user.name)},`,
		intro: ['Someone (hopefully you) asked to reset your password.'],
		actions: [{ label: 'Choose a new password', url: links.reset(token) }],
		outro: ['This link works for 1 hour. If you didn’t ask for it, you can ignore this email.']
	});
}

export function sendTestEmail(db: DB, to: string, settings = getSettings(db)): void {
	send(db, settings, to, `Test email from ${settings.orgName}`, 'test', {
		intro: ['It works! Shiftnest can send email from this server.'],
		actions: [{ label: 'Open Shiftnest', url: `${origin()}/admin` }]
	});
}
