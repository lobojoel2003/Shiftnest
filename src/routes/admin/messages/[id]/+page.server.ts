import { error } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { redirectWithFlash } from '#lib/server/flash.ts';
import { getOutboxMessage, retryMessage } from '#lib/server/outbox.ts';
import type { Actions, PageServerLoad } from './$types';
import { requireCoordinator } from '#lib/server/guards.ts';

export const load: PageServerLoad = ({ params, locals }) => {
	requireCoordinator(locals);
	const m = getOutboxMessage(getDb(), Number(params.id));
	if (!m) error(404, 'Message not found');
	return {
		message: {
			id: m.id,
			channel: m.channel,
			recipient: m.recipient,
			subject: m.subject,
			body: m.body_text,
			kind: m.kind,
			status: m.status,
			attempts: m.attempts,
			error: m.last_error,
			createdAt: m.created_at,
			sentAt: m.sent_at
		}
	};
};

export const actions: Actions = {
	retry: async (event) => {
		requireCoordinator(event.locals);
		const id = Number(event.params.id);
		retryMessage(getDb(), id);
		redirectWithFlash(event, `/admin/messages/${id}`, 'success', 'Queued to send again.');
	}
};
