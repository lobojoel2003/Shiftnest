<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const next = $derived(page.url.searchParams.get('next') ?? '/');
</script>

<svelte:head>
	<title>Use a different email · {data.org.name}</title>
</svelte:head>

<div class="container tiny page">
	<div class="card card-body stack">
		{#if data.volunteer}
			<h1 style="font-size: 1.4rem">Use a different email?</h1>
			<p class="muted">
				This device is signed in as <strong>{data.volunteer.name}</strong> ({data.volunteer.email}).
				Sign out here to sign up with another email. Your shifts stay safe.
			</p>
			<form method="POST" action="/my?/signout" class="form-actions">
				<input type="hidden" name="next" value={next} />
				<button class="btn btn-primary"
					><Icon name="logout" size={16} /> Sign out on this device</button
				>
				<a class="btn btn-ghost" href={next.startsWith('/') && !next.startsWith('//') ? next : '/'}
					>Cancel</a
				>
			</form>
		{:else}
			<h1 style="font-size: 1.4rem">You’re not signed in</h1>
			<p class="muted">You can sign up with any email address.</p>
			<a class="btn btn-primary" href="/">See shifts</a>
		{/if}
	</div>
</div>
