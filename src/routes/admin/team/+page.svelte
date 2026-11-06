<script lang="ts">
	import { enhance } from '$app/forms';
	import CopyField from '#lib/components/CopyField.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { confirmFirst } from '#lib/enhance.ts';
	import { formatter, initials } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const f = $derived(formatter(data.org));
	const isOwner = $derived(data.user.role === 'owner');
</script>

<svelte:head>
	<title>Team · {data.org.name}</title>
</svelte:head>

<header class="page-header">
	<div>
		<h1>Team</h1>
		<p>Coordinators can manage events, shifts and volunteers. Owners can also manage the team.</p>
	</div>
</header>

<div class="layout">
	<section class="card">
		{#if form?.teamError}
			<div class="alert alert-error" style="margin: 16px 20px 0">
				<Icon name="alert" size={18} />
				<p>{form.teamError}</p>
			</div>
		{/if}
		<ul class="list-plain">
			{#each data.members as m (m.id)}
				<li class="member">
					<span class="avatar">{initials(m.name)}</span>
					<div class="grow" style="min-width: 0">
						<p class="row" style="--gap: 8px">
							<span class="strong">{m.name}</span>
							{#if m.id === data.user.id}<span class="badge">You</span>{/if}
							{#if m.pending}<span class="badge badge-amber">Invite pending</span>{/if}
						</p>
						<p class="small muted truncate">
							{m.email}{m.lastLoginAt ? ` · last signed in ${f.date(m.lastLoginAt, true)}` : ''}
						</p>
					</div>
					{#if isOwner && m.id !== data.user.id}
						<form method="POST" action="?/role" use:enhance>
							<input type="hidden" name="userId" value={m.id} />
							<label class="sr-only" for="role-{m.id}">Role for {m.name}</label>
							<select
								id="role-{m.id}"
								name="role"
								value={m.role}
								onchange={(e) => e.currentTarget.form?.requestSubmit()}
								class="role-select"
							>
								<option value="coordinator">Coordinator</option>
								<option value="owner">Owner</option>
							</select>
						</form>
						{#if m.pending}
							<form method="POST" action="?/resend" use:enhance>
								<input type="hidden" name="userId" value={m.id} />
								<button class="btn btn-sm btn-ghost">Resend</button>
							</form>
						{/if}
						<form
							method="POST"
							action="?/remove"
							use:enhance={confirmFirst(`Remove ${m.name} from the team?`)}
						>
							<input type="hidden" name="userId" value={m.id} />
							<button class="btn btn-sm btn-ghost btn-icon" title="Remove"
								><Icon name="trash" size={16} label="Remove {m.name}" /></button
							>
						</form>
					{:else}
						<span class="badge {m.role === 'owner' ? 'badge-accent' : ''}"
							>{m.role === 'owner' ? 'Owner' : 'Coordinator'}</span
						>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	{#if isOwner}
		<section class="card">
			<div class="card-header"><h2>Invite a coordinator</h2></div>
			{#if form?.inviteUrl}
				<div class="card-body stack" style="--gap: 10px">
					<div class="alert alert-success">
						<Icon name="check-circle" size={18} />
						<p>
							Invitation for {form.invited} created. We emailed it, and you can also share this link (valid
							7 days):
						</p>
					</div>
					<CopyField value={form.inviteUrl} label="Invitation link" />
					<a href="/admin/team" class="small">Invite someone else</a>
				</div>
			{:else}
				<form
					method="POST"
					action="?/invite"
					class="card-body stack"
					style="--gap: 12px"
					use:enhance
				>
					<div class="field">
						<label for="inv-name">Name</label>
						<input
							id="inv-name"
							name="name"
							type="text"
							required
							maxlength="100"
							value={form?.values?.name ?? ''}
						/>
						{#if form?.errors?.name}<p class="error-text">{form.errors.name}</p>{/if}
					</div>
					<div class="field">
						<label for="inv-email">Email</label>
						<input
							id="inv-email"
							name="email"
							type="email"
							required
							value={form?.values?.email ?? ''}
						/>
						{#if form?.errors?.email}<p class="error-text">{form.errors.email}</p>{/if}
					</div>
					<div class="field">
						<label for="inv-role">Role</label>
						<select id="inv-role" name="role" value={form?.values?.role ?? 'coordinator'}>
							<option value="coordinator">Coordinator</option>
							<option value="owner">Owner (can manage the team)</option>
						</select>
					</div>
					<button class="btn btn-primary btn-sm"
						><Icon name="send" size={15} /> Send invitation</button
					>
				</form>
			{/if}
		</section>
	{/if}
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 24px;
	}
	@media (min-width: 1100px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 360px;
			align-items: start;
		}
	}
	.member {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 20px;
	}
	.member + .member {
		border-top: 1px solid var(--border);
	}
	.role-select {
		width: auto;
		min-height: 32px;
		padding: 4px 8px;
		font-size: 0.85rem;
	}
</style>
