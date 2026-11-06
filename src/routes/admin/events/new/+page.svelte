<script lang="ts">
	import { enhance } from '$app/forms';
	import EventFields from '#lib/components/EventFields.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>New event · {data.org.name}</title>
</svelte:head>

<a href="/admin/events" class="back-link"><Icon name="arrow-left" size={16} /> Events</a>
<header class="page-header">
	<div>
		<h1>New event</h1>
		<p>You’ll add shifts on the next step.</p>
	</div>
</header>

<form method="POST" class="card" use:enhance style="max-width: 760px">
	<div class="card-body">
		<EventFields values={form?.values ?? { status: 'published' }} errors={form?.errors} />
	</div>
	<div class="card-footer form-actions">
		<button class="btn btn-primary">Create event</button>
		<a href="/admin/events" class="btn btn-ghost">Cancel</a>
	</div>
</form>
