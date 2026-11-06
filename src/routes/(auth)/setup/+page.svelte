<script lang="ts">
	import { enhance } from '$app/forms';
	import { pending } from '#lib/enhance.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);
	let timezone = $state('UTC');

	$effect(() => {
		if (form?.values?.timezone) timezone = form.values.timezone;
		else timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	});
</script>

<svelte:head>
	<title>Set up Shiftnest</title>
</svelte:head>

<div class="stack" style="--gap: 20px">
	<div class="stack" style="--gap: 6px">
		<p class="eyebrow">Welcome</p>
		<h1 style="font-size: 1.5rem">Set up Shiftnest</h1>
		<p class="muted small">Create the first coordinator account. You can invite teammates later.</p>
	</div>

	<form method="POST" class="stack" use:enhance={pending((v) => (busy = v))}>
		<div class="field">
			<label for="orgName">Group or organization name</label>
			<input
				id="orgName"
				name="orgName"
				type="text"
				required
				maxlength="100"
				placeholder="e.g. Riverside Food Bank"
				value={form?.values?.orgName ?? ''}
				aria-invalid={form?.errors?.orgName ? 'true' : undefined}
			/>
			{#if form?.errors?.orgName}<p class="error-text">{form.errors.orgName}</p>{/if}
		</div>
		<div class="field">
			<label for="name">Your name</label>
			<input
				id="name"
				name="name"
				type="text"
				required
				maxlength="100"
				autocomplete="name"
				value={form?.values?.name ?? ''}
				aria-invalid={form?.errors?.name ? 'true' : undefined}
			/>
			{#if form?.errors?.name}<p class="error-text">{form.errors.name}</p>{/if}
		</div>
		<div class="field">
			<label for="email">Email</label>
			<input
				id="email"
				name="email"
				type="email"
				required
				autocomplete="email"
				value={form?.values?.email ?? ''}
				aria-invalid={form?.errors?.email ? 'true' : undefined}
			/>
			{#if form?.errors?.email}<p class="error-text">{form.errors.email}</p>{/if}
		</div>
		<div class="field">
			<label for="password">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				required
				minlength="10"
				autocomplete="new-password"
				aria-invalid={form?.errors?.password ? 'true' : undefined}
				aria-describedby="pw-hint"
			/>
			{#if form?.errors?.password}<p class="error-text">{form.errors.password}</p>{:else}<p
					class="hint"
					id="pw-hint"
				>
					At least 10 characters.
				</p>{/if}
		</div>
		<div class="field">
			<label for="timezone">Time zone</label>
			<select id="timezone" name="timezone" bind:value={timezone}>
				{#each data.zones as zone (zone)}<option value={zone}>{zone.replace(/_/g, ' ')}</option
					>{/each}
			</select>
			<p class="hint">Shift times are shown in this zone.</p>
		</div>
		<button class="btn btn-primary btn-block btn-lg" disabled={busy}
			>{busy ? 'Creating…' : 'Create account'}</button
		>
	</form>
</div>
