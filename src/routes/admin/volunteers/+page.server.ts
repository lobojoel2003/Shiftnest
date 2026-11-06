import { getDb } from '#lib/server/db/index.ts';
import { getSettings } from '#lib/server/settings.ts';
import { listVolunteers } from '#lib/server/volunteers.ts';
import type { PageServerLoad } from './$types';
import { requireCoordinator } from '#lib/server/guards.ts';

const PAGE_SIZE = 50;

export const load: PageServerLoad = ({ url, locals }) => {
	requireCoordinator(locals);
	const db = getDb();
	const q = url.searchParams.get('q')?.slice(0, 100) ?? '';
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const { items, total } = listVolunteers(db, {
		search: q,
		assumeAttendance: getSettings(db).assumeAttendance,
		limit: PAGE_SIZE,
		offset: (page - 1) * PAGE_SIZE
	});
	return {
		q,
		page,
		pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
		total,
		volunteers: items.map((v) => ({
			id: v.id,
			name: v.name,
			email: v.email,
			phone: v.phone,
			upcoming: v.upcoming,
			completed: v.completed,
			noShows: v.no_shows,
			hours: v.hours,
			lastShiftAt: v.last_shift_at,
			joinedAt: v.created_at
		}))
	};
};
