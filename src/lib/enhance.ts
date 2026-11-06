import type { SubmitFunction } from '$app/forms';

/** `use:enhance={confirmFirst('Sure?')}`: ask before submitting a destructive form. */
export function confirmFirst(message: string): SubmitFunction {
	return ({ cancel }) => {
		if (!confirm(message)) cancel();
	};
}

/** Track a pending state while a form submits: `use:enhance={pending((v) => (busy = v))}` */
export function pending(set: (value: boolean) => void): SubmitFunction {
	return () => {
		set(true);
		return async ({ update }) => {
			await update();
			set(false);
		};
	};
}
