<script lang="ts">
	import type { EventStatus, SignupStatus } from '../types.ts';

	let { status }: { status: SignupStatus | EventStatus | 'cover' } = $props();

	const map: Record<string, [string, string]> = {
		confirmed: ['Confirmed', 'badge-accent'],
		attended: ['Attended', 'badge-green'],
		no_show: ['No-show', 'badge-red'],
		cancelled: ['Cancelled', ''],
		published: ['Published', 'badge-green'],
		draft: ['Draft', 'badge-amber'],
		archived: ['Archived', ''],
		cover: ['Needs cover', 'badge-amber']
	};
	const entry = $derived(map[status] ?? [status, '']);
</script>

<span class="badge {entry[1]}">{entry[0]}</span>
