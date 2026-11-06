import { error, fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.ts';
import { redirectWithFlash } from '#lib/server/flash.ts';
import { links, sendInvite } from '#lib/server/notifications.ts';
import {
	createAuthToken,
	createUser,
	deleteUser,
	getUser,
	getUserByEmail,
	listUsers,
	updateUser
} from '#lib/server/users.ts';
import { int, isEmail, text } from '#lib/server/validation.ts';
import type { Role } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';
import { requireCoordinator } from '#lib/server/guards.ts';

const INVITE_TTL = 7 * 86_400_000;

function requireOwner(locals: App.Locals) {
	if (locals.user?.role !== 'owner') error(403, 'Only owners can manage the team.');
	return locals.user;
}

export const load: PageServerLoad = ({ locals }) => {
	requireCoordinator(locals);
	return {
		members: listUsers(getDb()).map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			role: u.role,
			pending: !u.password_hash,
			lastLoginAt: u.last_login_at
		}))
	};
};

export const actions: Actions = {
	invite: async (event) => {
		requireCoordinator(event.locals);
		const owner = requireOwner(event.locals);
		const db = getDb();
		const data = await event.request.formData();
		const values = {
			name: text(data, 'name', 100),
			email: text(data, 'email', 254).toLowerCase(),
			role: (text(data, 'role', 20) === 'owner' ? 'owner' : 'coordinator') as Role
		};
		const errors: Record<string, string> = {};
		if (!values.name) errors.name = 'Enter their name.';
		if (!isEmail(values.email)) errors.email = 'Enter a valid email.';
		else if (getUserByEmail(db, values.email)) errors.email = 'They’re already on the team.';
		if (Object.keys(errors).length) return fail(400, { values, errors });

		const user = await createUser(db, values);
		const token = createAuthToken(db, user.id, 'invite', INVITE_TTL);
		sendInvite(db, user, token, owner.name);
		return { invited: user.name, inviteUrl: links.invite(token) };
	},

	resend: async (event) => {
		requireCoordinator(event.locals);
		const owner = requireOwner(event.locals);
		const db = getDb();
		const user = getUser(db, int(await event.request.formData(), 'userId') ?? 0);
		if (!user || user.password_hash) return fail(400);
		const token = createAuthToken(db, user.id, 'invite', INVITE_TTL);
		sendInvite(db, user, token, owner.name);
		return { invited: user.name, inviteUrl: links.invite(token) };
	},

	role: async (event) => {
		requireCoordinator(event.locals);
		const owner = requireOwner(event.locals);
		const db = getDb();
		const data = await event.request.formData();
		const userId = int(data, 'userId') ?? 0;
		const role: Role = text(data, 'role', 20) === 'owner' ? 'owner' : 'coordinator';
		if (userId === owner.id) return fail(400, { teamError: 'You can’t change your own role.' });
		updateUser(db, userId, { role });
		redirectWithFlash(event, '/admin/team', 'success', 'Role updated.');
	},

	remove: async (event) => {
		requireCoordinator(event.locals);
		const owner = requireOwner(event.locals);
		const db = getDb();
		const userId = int(await event.request.formData(), 'userId') ?? 0;
		if (userId === owner.id) return fail(400, { teamError: 'You can’t remove yourself.' });
		const user = getUser(db, userId);
		if (!user) return fail(404);
		deleteUser(db, userId);
		redirectWithFlash(event, '/admin/team', 'success', `${user.name} no longer has access.`);
	}
};
