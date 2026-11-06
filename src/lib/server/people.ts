import type { Cookies } from '@sveltejs/kit';
import type { OrgSettings, SessionVolunteer } from '../types';
import type { DB } from './db';
import { startVolunteerSession } from './sessions';
import { checkbox, isEmail, longText, normalizePhone, text } from './validation';
import {
	findOrCreateVolunteer,
	getVolunteer,
	updateVolunteer,
	type VolunteerRow
} from './volunteers';

/** Fields of the "who are you?" form used on sign-up and cover pages. */
export interface PersonValues {
	name: string;
	email: string;
	phone: string;
	sms: boolean;
	note: string;
}

export type PersonErrors = Partial<Record<keyof PersonValues, string>>;

export function readPerson(
	data: FormData,
	settings: OrgSettings
): { values: PersonValues; errors: PersonErrors; phone: string } {
	const values: PersonValues = {
		name: text(data, 'name', 100),
		email: text(data, 'email', 254).toLowerCase(),
		phone: text(data, 'phone', 40),
		sms: checkbox(data, 'sms'),
		note: longText(data, 'note', 500)
	};
	const errors: PersonErrors = {};
	if (!values.name) errors.name = 'Please enter your name.';
	if (!isEmail(values.email)) errors.email = 'Please enter a valid email address.';
	const phone = normalizePhone(values.phone, settings.phoneCountryCode);
	if (phone === null) errors.phone = 'That doesn’t look like a phone number.';
	if (values.sms && !phone) errors.phone = 'Add a mobile number to get text reminders.';
	return { values, errors, phone: phone ?? '' };
}

/** Bots fill in every field, including the hidden "website" one. */
export function isSpam(data: FormData): boolean {
	return text(data, 'website', 200) !== '';
}

/**
 * Work out which volunteer is submitting the form.
 * Signed-in volunteers update their own details. New emails create a volunteer
 * and sign them in on this device. An existing email that isn't signed in is
 * used as-is (we never let a public form change someone else's details).
 */
export function resolveVolunteer(
	db: DB,
	ctx: { locals: { volunteer: SessionVolunteer | null }; cookies: Cookies; url: URL },
	values: PersonValues,
	phone: string
): { volunteer: VolunteerRow; signedIn: boolean } {
	const current = ctx.locals.volunteer;
	if (current && current.email.toLowerCase() === values.email) {
		updateVolunteer(db, current.id, {
			name: values.name,
			phone,
			smsOptIn: values.sms
		});
		return { volunteer: getVolunteer(db, current.id)!, signedIn: true };
	}
	const { volunteer, created } = findOrCreateVolunteer(db, {
		name: values.name,
		email: values.email,
		phone,
		smsOptIn: values.sms
	});
	if (created) {
		startVolunteerSession(db, ctx.cookies, ctx.url, volunteer.id);
		return { volunteer, signedIn: true };
	}
	return { volunteer, signedIn: false };
}
