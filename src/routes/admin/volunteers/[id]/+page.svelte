<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import { confirmFirst } from '#lib/enhance.ts';
	import { formatter, initials } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const f = $derived(formatter(data.org));
	const v = $derived(data.volunteer);
	const values = $derived(form?.values ?? v);
</script>

<svelte:head>
	<title>{v.name} · Volunteers</title>
</svelte:head>

<a href="/admin/volunteers" class="back-link"><Icon name="arrow-left" size={16} /> Volunteers</a>

<header class="page-header">
	<div class="row" style="--gap: 16px">
		<span class="avatar big">{initials(v.name)}</span>
		<div>
			<h1>{v.name}</h1>
			<p class="row" style="--gap: 4px 14px; margin-top: 4px">
				<a href="mailto:{v.email}" class="icon-text"><Icon name="mail" size={15} />{v.email}</a>
				{#if v.phone}<a href="tel:{v.phone}" class="icon-text"
						><Icon name="phone" size={15} />{v.phone}</a
					>{/if}
				<span class="subtle small">Joined {f.date(v.createdAt, true)}</span>
			</p>
		</div>
	</div>
	<form method="POST" action="?/sendLink" use:enhance>
		<button class="btn btn-sm"><Icon name="send" size={15} /> Email their shifts link</button>
	</form>
</header>

<div class="layout">
	<div class="stack" style="--gap: 20px">
		<div class="stats">
			<div class="card stat">
				<span class="value tabular"
					>{data.signups.filter((s) => s.upcoming && s.status === 'confirmed').length}</span
				><span class="label">Upcoming</span>
			</div>
			<div class="card stat">
				<span class="value tabular">{data.totals.shifts}</span><span class="label"
					>Shifts completed</span
				>
			</div>
			<div class="card stat">
				<span class="value tabular">{Math.round(data.totals.hours * 10) / 10}</span><span
					class="label">Hours</span
				>
			</div>
		</div>

		<section class="card">
			<div class="card-header"><h2>Shift history</h2></div>
			{#if data.signups.length === 0}
				<div class="empty small"><p>No shifts yet.</p></div>
			{:else}
				<div class="table-wrap">
					<table class="table">
						<thead
							><tr><th>Date</th><th>Shift</th><th>Status</th><th class="num">Hours</th></tr></thead
						>
						<tbody>
							{#each data.signups as s (s.id)}
								<tr>
									<td class="nowrap"
										>{f.date(s.startsAt, true)}
										<span class="subtle small">{f.time(s.startsAt)}</span></td
									>
									<td
										><a href="/admin/shifts/{s.shiftId}" class="strong">{s.role}</a>
										<span class="subtle small">· {s.eventTitle}</span></td
									>
									<td>
										<StatusBadge status={s.status} />
										{#if s.needsCover}<StatusBadge status="cover" />{/if}
									</td>
									<td class="num"
										>{s.hours ??
											(s.status === 'attended'
												? f.hours((s.endsAt - s.startsAt) / 3_600_000)
												: '–')}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	</div>

	<aside class="stack" style="--gap: 20px">
		<section class="card">
			<div class="card-header"><h2>Details</h2></div>
			<form method="POST" action="?/update" class="card-body stack" style="--gap: 12px" use:enhance>
				<div class="field">
					<label for="name">Name</label>
					<input id="name" name="name" type="text" required maxlength="100" value={values.name} />
					{#if form?.errors?.name}<p class="error-text">{form.errors.name}</p>{/if}
				</div>
				<div class="field">
					<label for="email">Email</label>
					<input id="email" name="email" type="email" required value={values.email} />
					{#if form?.errors?.email}<p class="error-text">{form.errors.email}</p>{/if}
				</div>
				<div class="field">
					<label for="phone">Phone</label>
					<input id="phone" name="phone" type="tel" value={values.phone} />
					{#if form?.errors?.phone}<p class="error-text">{form.errors.phone}</p>{/if}
				</div>
				<label class="check small"
					><input type="checkbox" name="sms" checked={values.sms} /> Text reminders</label
				>
				<div class="field">
					<label for="notes">Private notes</label>
					<textarea
						id="notes"
						name="notes"
						rows="3"
						maxlength="2000"
						placeholder="Only coordinators can see this">{values.notes}</textarea
					>
				</div>
				<button class="btn btn-primary btn-sm">Save</button>
			</form>
		</section>

		<section class="card card-body stack" style="--gap: 10px">
			<h2 style="font-size: 1rem">Privacy</h2>
			<form
				method="POST"
				action="?/rotate"
				use:enhance={confirmFirst('Disable their current personal and calendar links?')}
			>
				<button class="btn btn-sm btn-block"
					><Icon name="refresh" size={15} /> Reset personal links</button
				>
			</form>
			<form
				method="POST"
				action="?/delete"
				use:enhance={confirmFirst(
					`Delete ${v.name} and all their shift history? This can’t be undone.`
				)}
			>
				<button class="btn btn-sm btn-danger btn-block"
					><Icon name="trash" size={15} /> Delete volunteer</button
				>
			</form>
			<p class="hint">
				Deleting removes their contact details, sign-ups and hours, for example when someone asks to
				be forgotten.
			</p>
		</section>
	</aside>
</div>

<style>
	.avatar.big {
		width: 56px;
		height: 56px;
		font-size: 1.1rem;
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 24px;
	}
	@media (min-width: 1100px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 340px;
			align-items: start;
		}
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
	}
	.stat {
		padding: 14px 18px;
		display: flex;
		flex-direction: column;
	}
	.stat .value {
		font-size: 1.6rem;
		font-weight: 750;
	}
	.stat .label {
		font-size: 0.84rem;
		color: var(--text-2);
	}
</style>
