import { fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { createEvent } from '#lib/server/events.ts';
import { redirectWithFlash } from '#lib/server/flash.ts';
import { readEventForm } from '#lib/server/forms.ts';
import type { Actions } from './$types';
import { requireCoordinator } from '#lib/server/guards.ts';

export const actions: Actions = {
	default: async (event) => {
		requireCoordinator(event.locals);
		const { values, errors } = readEventForm(await event.request.formData());
		if (Object.keys(errors).length) return fail(400, { values, errors });
		const created = createEvent(getDb(), values);
		redirectWithFlash(
			event,
			`/admin/events/${created.id}#add-shifts`,
			'success',
			'Event created. Now add some shifts.'
		);
	}
};
