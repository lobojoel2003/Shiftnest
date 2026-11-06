import { getDb } from '#lib/server/db/index.ts';
import { readFlash } from '#lib/server/flash.ts';
import { getSettings } from '#lib/server/settings.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, cookies }) => {
	const settings = getSettings(getDb());
	return {
		org: {
			name: settings.orgName,
			tagline: settings.tagline,
			contactEmail: settings.contactEmail,
			timezone: settings.timezone,
			locale: settings.locale
		},
		user: locals.user,
		volunteer: locals.volunteer,
		flash: readFlash(cookies)
	};
};
