import { config } from '#lib/server/config.ts';
import { getDb } from '#lib/server/db/index.ts';
import { listOutbox, type OutboxStatus } from '#lib/server/outbox.ts';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = ({ url }) => {
	const raw = url.searchParams.get('status') ?? 'all';
	const status = (['all', 'pending', 'sent', 'failed', 'logged'].includes(raw) ? raw : 'all') as
		OutboxStatus | 'all';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const { items, total, counts } = listOutbox(getDb(), {
		status,
		limit: PAGE_SIZE,
		offset: (page - 1) * PAGE_SIZE
	});
	const cfg = config();
	return {
		status,
		page,
		pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
		counts,
		email: cfg.smtp ? (cfg.smtp.host ?? 'SMTP URL') : null,
		sms: cfg.twilio !== null,
		messages: items.map((m) => ({
			id: m.id,
			channel: m.channel,
			recipient: m.recipient,
			subject: m.subject || m.body_text.slice(0, 80),
			kind: m.kind,
			status: m.status,
			attempts: m.attempts,
			error: m.last_error,
			createdAt: m.created_at
		}))
	};
};
