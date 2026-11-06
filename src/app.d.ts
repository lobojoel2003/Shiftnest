// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SessionUser, SessionVolunteer } from './lib/types.ts';

declare global {
	/** Build metadata injected by vite.config.ts at build time. */
	const __SHIFTNEST_BUILD__: {
		version: string;
		buildNumber: string;
		commit: string;
		date: string;
	};

	namespace App {
		interface Error {
			message: string;
		}
		interface Locals {
			/** Signed-in coordinator, if any. */
			user: SessionUser | null;
			/** Volunteer recognised from their personal link cookie, if any. */
			volunteer: SessionVolunteer | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
