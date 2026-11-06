<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Reset password</title>
</svelte:head>

<div class="stack" style="--gap: 20px">
	<div class="stack" style="--gap: 6px">
		<h1 style="font-size: 1.5rem">Reset your password</h1>
		<p class="muted small">We’ll email you a link to choose a new one.</p>
	</div>
	{#if form?.sent}
		<div class="alert alert-success" role="status">
			<Icon name="mail" size={18} />
			<p>
				If {form.email} has a coordinator account, a reset link is on its way. It works for one hour.
			</p>
		</div>
		<a href="/login" class="btn btn-block">Back to sign in</a>
	{:else}
		<form method="POST" class="stack" use:enhance>
			<div class="field">
				<label for="email">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					required
					autocomplete="email"
					value={form?.email ?? ''}
					aria-invalid={form?.error ? 'true' : undefined}
				/>
				{#if form?.error}<p class="error-text">{form.error}</p>{/if}
			</div>
			<button class="btn btn-primary btn-block">Send reset link</button>
			<a href="/login" class="small center">Back to sign in</a>
		</form>
	{/if}
</div>
