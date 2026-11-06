<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>My account · {data.org.name}</title>
</svelte:head>

<header class="page-header"><div><h1>My account</h1></div></header>

<div class="stack" style="--gap: 20px; max-width: 620px">
	<form method="POST" action="?/profile" class="card" use:enhance>
		<div class="card-header"><h2>Profile</h2></div>
		<div class="card-body stack" style="--gap: 14px">
			<div class="field">
				<label for="name">Name</label>
				<input
					id="name"
					name="name"
					type="text"
					required
					maxlength="100"
					autocomplete="name"
					value={data.account.name}
				/>
				{#if form?.profileErrors?.name}<p class="error-text">{form.profileErrors.name}</p>{/if}
			</div>
			<div class="field">
				<label for="email">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					required
					autocomplete="email"
					value={data.account.email}
				/>
				{#if form?.profileErrors?.email}<p class="error-text">{form.profileErrors.email}</p>{/if}
			</div>
			<label class="check"
				><input type="checkbox" name="notify" checked={data.account.notify} /><span
					>Email me when a volunteer cancels or asks for cover</span
				></label
			>
		</div>
		<div class="card-footer"><button class="btn btn-primary btn-sm">Save</button></div>
	</form>

	<form method="POST" action="?/password" class="card" use:enhance>
		<div class="card-header"><h2>Change password</h2></div>
		<div class="card-body stack" style="--gap: 14px">
			{#if form?.passwordError}<div class="alert alert-error">
					<Icon name="alert" size={18} />
					<p>{form.passwordError}</p>
				</div>{/if}
			<input
				type="text"
				name="username"
				autocomplete="username"
				value={data.account.email}
				hidden
			/>
			<div class="field">
				<label for="current">Current password</label>
				<input
					id="current"
					name="current"
					type="password"
					required
					autocomplete="current-password"
				/>
			</div>
			<div class="field">
				<label for="password">New password</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					minlength="10"
					autocomplete="new-password"
				/>
			</div>
			<div class="field">
				<label for="confirm">Confirm new password</label>
				<input
					id="confirm"
					name="confirm"
					type="password"
					required
					minlength="10"
					autocomplete="new-password"
				/>
			</div>
		</div>
		<div class="card-footer"><button class="btn btn-sm">Change password</button></div>
	</form>
</div>
