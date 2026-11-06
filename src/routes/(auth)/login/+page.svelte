<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import { pending } from '#lib/enhance.ts';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let busy = $state(false);
</script>

<svelte:head>
	<title>Coordinator sign in</title>
</svelte:head>

<div class="stack" style="--gap: 20px">
	<div class="stack" style="--gap: 6px">
		<h1 style="font-size: 1.5rem">Coordinator sign in</h1>
		<p class="muted small">
			Volunteers don’t need an account. <a href="/my">Find your shifts here.</a>
		</p>
	</div>
	<form method="POST" class="stack" use:enhance={pending((v) => (busy = v))}>
		{#if form?.error}
			<div class="alert alert-error" role="alert">
				<Icon name="alert" size={18} />
				<p>{form.error}</p>
			</div>
		{/if}
		<div class="field">
			<label for="email">Email</label>
			<input
				id="email"
				name="email"
				type="email"
				required
				autocomplete="username"
				value={form?.email ?? ''}
			/>
		</div>
		<div class="field">
			<div class="row between">
				<label for="password" class="label">Password</label><a href="/login/forgot" class="small"
					>Forgot?</a
				>
			</div>
			<input
				id="password"
				name="password"
				type="password"
				required
				autocomplete="current-password"
			/>
		</div>
		<button class="btn btn-primary btn-block btn-lg" disabled={busy}>
			<Icon name="login" size={18} />{busy ? 'Signing in…' : 'Sign in'}
		</button>
	</form>
</div>
