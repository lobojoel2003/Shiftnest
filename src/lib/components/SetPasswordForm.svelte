<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from './Icon.svelte';

	let {
		error = null,
		askName = false,
		name = '',
		submitLabel = 'Save password'
	}: { error?: string | null; askName?: boolean; name?: string; submitLabel?: string } = $props();
</script>

<form method="POST" class="stack" use:enhance>
	{#if error}
		<div class="alert alert-error" role="alert">
			<Icon name="alert" size={18} />
			<p>{error}</p>
		</div>
	{/if}
	{#if askName}
		<div class="field">
			<label for="name">Your name</label>
			<input
				id="name"
				name="name"
				type="text"
				required
				maxlength="100"
				autocomplete="name"
				value={name}
			/>
		</div>
	{/if}
	<div class="field">
		<label for="password">New password</label>
		<input
			id="password"
			name="password"
			type="password"
			required
			minlength="10"
			autocomplete="new-password"
			aria-describedby="pw-hint"
		/>
		<p class="hint" id="pw-hint">At least 10 characters.</p>
	</div>
	<div class="field">
		<label for="confirm">Confirm password</label>
		<input
			id="confirm"
			name="confirm"
			type="password"
			required
			minlength="10"
			autocomplete="new-password"
		/>
	</div>
	<button class="btn btn-primary btn-block btn-lg">{submitLabel}</button>
</form>
