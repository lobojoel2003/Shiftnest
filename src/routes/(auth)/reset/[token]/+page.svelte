<script lang="ts">
	import SetPasswordForm from '#lib/components/SetPasswordForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Choose a new password</title>
</svelte:head>

<div class="stack" style="--gap: 20px">
	{#if data.valid}
		<div class="stack" style="--gap: 6px">
			<h1 style="font-size: 1.5rem">Choose a new password</h1>
			<p class="muted small">For {data.email}</p>
		</div>
		<SetPasswordForm error={form?.error} />
	{:else}
		<h1 style="font-size: 1.5rem">This link has expired</h1>
		<p class="muted">Reset links work once, for one hour.</p>
		<a class="btn btn-primary" href="/login/forgot">Send a new link</a>
	{/if}
</div>
