import { fail } from '@sveltejs/kit';
import { config } from '#lib/server/config.ts';
import { getDb } from '#lib/server/db/index.ts';
import { redirectWithFlash } from '#lib/server/flash.ts';
import { sendTestEmail } from '#lib/server/notifications.ts';
import { rateLimit } from '#lib/server/rate-limit.ts';
import { getSettings, parseHoursList, updateSettings } from '#lib/server/settings.ts';
import { checkbox, int, isEmail, text } from '#lib/server/validation.ts';
import { isValidLocale, isValidTimeZone, timeZones } from '#lib/time.ts';
import { BUILD } from '#lib/version.ts';
import type { Actions, PageServerLoad } from './$types';
import { requireCoordinator } from '#lib/server/guards.ts';

const LOCALES = [
	['en-US', 'English (US): 9:00 AM, Nov 14'],
	['en-GB', 'English (UK): 09:00, 14 Nov'],
	['en-CA', 'English (Canada)'],
	['en-AU', 'English (Australia)'],
	['en-IN', 'English (India)'],
	['en-IE', 'English (Ireland)'],
	['en-NZ', 'English (New Zealand)'],
	['es-ES', 'Español (España)'],
	['es-MX', 'Español (México)'],
	['fr-FR', 'Français'],
	['fr-CA', 'Français (Canada)'],
	['de-DE', 'Deutsch'],
	['it-IT', 'Italiano'],
	['nl-NL', 'Nederlands'],
	['pt-BR', 'Português (Brasil)'],
	['sv-SE', 'Svenska']
] as const;

export const load: PageServerLoad = ({ locals }) => {
	requireCoordinator(locals);
	const cfg = config();
	return {
		settings: getSettings(getDb()),
		zones: timeZones(),
		locales: LOCALES,
		integrations: {
			smtpHost: cfg.smtp ? (cfg.smtp.host ?? '(SMTP_URL)') : null,
			mailFrom: cfg.mailFrom,
			twilio: cfg.twilio !== null,
			origin: cfg.origin,
			originConfigured: cfg.originConfigured,
			databasePath: cfg.databasePath
		},
		build: BUILD
	};
};

export const actions: Actions = {
	save: async (event) => {
		requireCoordinator(event.locals);
		const data = await event.request.formData();
		const errors: Record<string, string> = {};
		const orgName = text(data, 'orgName', 100);
		const contactEmail = text(data, 'contactEmail', 254).toLowerCase();
		const timezone = text(data, 'timezone', 64);
		const locale = text(data, 'locale', 20);
		const reminderHours = parseHoursList(text(data, 'reminderHours', 50));
		const smsReminderHours = parseHoursList(text(data, 'smsReminderHours', 50));
		const cancelCutoffHours = int(data, 'cancelCutoffHours');
		const phoneCountryCode = text(data, 'phoneCountryCode', 6);

		if (!orgName) errors.orgName = 'Enter your group’s name.';
		if (contactEmail && !isEmail(contactEmail))
			errors.contactEmail = 'Enter a valid email or leave it blank.';
		if (!isValidTimeZone(timezone)) errors.timezone = 'Pick a time zone.';
		if (!isValidLocale(locale)) errors.locale = 'Pick a format.';
		if (!reminderHours)
			errors.reminderHours = 'Use numbers of hours separated by commas, like 24, 2.';
		if (!smsReminderHours)
			errors.smsReminderHours = 'Use numbers of hours separated by commas, like 2.';
		if (cancelCutoffHours === null || cancelCutoffHours < 0 || cancelCutoffHours > 336) {
			errors.cancelCutoffHours = 'Between 0 and 336 hours.';
		}
		if (!/^\+\d{1,4}$/.test(phoneCountryCode)) errors.phoneCountryCode = 'Like +1 or +44.';
		if (Object.keys(errors).length) return fail(400, { errors });

		updateSettings(getDb(), {
			orgName,
			tagline: text(data, 'tagline', 300),
			contactEmail,
			timezone,
			locale,
			reminderHours: reminderHours!,
			smsReminderHours: smsReminderHours!,
			cancelCutoffHours: cancelCutoffHours!,
			allowSelfCheckin: checkbox(data, 'allowSelfCheckin'),
			assumeAttendance: checkbox(data, 'assumeAttendance'),
			phoneCountryCode
		});
		redirectWithFlash(event, '/admin/settings', 'success', 'Settings saved.');
	},

	testEmail: async (event) => {
		requireCoordinator(event.locals);
		const user = event.locals.user!;
		if (!rateLimit(`test-email:${user.id}`, 5, 10 * 60_000)) {
			return fail(429, { testError: 'Please wait a few minutes before sending another test.' });
		}
		sendTestEmail(getDb(), user.email);
		redirectWithFlash(
			event,
			'/admin/messages',
			'success',
			config().smtp
				? `Test email queued to ${user.email}. Check its status below.`
				: 'Email isn’t configured, so the test was logged here instead of sent.'
		);
	}
};
