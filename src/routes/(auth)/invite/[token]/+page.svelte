<script lang="ts">
	import SetPasswordForm from '#lib/components/SetPasswordForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Accept invitation · {data.org.name}</title>
</svelte:head>

<div class="stack" style="--gap: 20px">
	{#if data.valid}
		<div class="stack" style="--gap: 6px">
			<p class="eyebrow">You’re invited</p>
			<h1 style="font-size: 1.5rem">Join {data.org.name}</h1>
			<p class="muted small">Set a password for {data.email} to start coordinating volunteers.</p>
		</div>
		<SetPasswordForm error={form?.error} askName name={data.name} submitLabel="Create my account" />
	{:else}
		<h1 style="font-size: 1.5rem">This invitation has expired</h1>
		<p class="muted">
			Invitations work once, for 7 days. Ask the person who invited you to send a new one.
		</p>
		<a class="btn" href="/login">Go to sign in</a>
	{/if}
</div>
