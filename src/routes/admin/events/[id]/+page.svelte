<script lang="ts">
	import { enhance } from '$app/forms';
	import CopyField from '#lib/components/CopyField.svelte';
	import EventFields from '#lib/components/EventFields.svelte';
	import FillMeter from '#lib/components/FillMeter.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import ShiftFields from '#lib/components/ShiftFields.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import { confirmFirst } from '#lib/enhance.ts';
	import { formatter, plural } from '#lib/format.ts';
	import { dayKey } from '#lib/time.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const f = $derived(formatter(data.org));
	const e = $derived(data.event);

	const days = $derived.by(() => {
		const groups: { key: string; first: number; shifts: typeof data.shifts }[] = [];
		for (const s of data.shifts) {
			const key = dayKey(s.startsAt, data.org.timezone);
			let g = groups.at(-1);
			if (!g || g.key !== key) groups.push((g = { key, first: s.startsAt, shifts: [] }));
			g.shifts.push(s);
		}
		return groups;
	});
	const totals = $derived(
		data.shifts
			.filter((s) => !s.past)
			.reduce(
				(t, s) => ({
					filled: t.filled + Math.min(s.filled, s.capacity),
					capacity: t.capacity + s.capacity
				}),
				{ filled: 0, capacity: 0 }
			)
	);
</script>

<svelte:head>
	<title>{e.title} · {data.org.name}</title>
</svelte:head>

<a href="/admin/events" class="back-link"><Icon name="arrow-left" size={16} /> Events</a>

<header class="page-header">
	<div>
		<div class="row" style="--gap: 10px">
			<h1>{e.title}</h1>
			<StatusBadge status={e.status} />
		</div>
		{#if e.location}<p class="icon-text"><Icon name="pin" size={16} />{e.location}</p>{/if}
	</div>
	<div class="row" style="--gap: 8px">
		<a class="btn btn-sm" href="/events/{e.slug}" target="_blank" rel="noopener"
			><Icon name="eye" size={15} /> {e.status === 'draft' ? 'Preview' : 'View page'}</a
		>
		<a class="btn btn-sm" href="/admin/events/{e.id}/message"
			><Icon name="mail" size={15} /> Message volunteers</a
		>
		<a class="btn btn-sm" href="/admin/events/{e.id}/print"
			><Icon name="printer" size={15} /> Print roster</a
		>
		<a class="btn btn-sm" href="/admin/events/{e.id}/roster.csv" download
			><Icon name="download" size={15} /> CSV</a
		>
		{#if e.status !== 'published'}
			<form method="POST" action="?/status" use:enhance>
				<input type="hidden" name="status" value="published" />
				<button class="btn btn-sm btn-primary"><Icon name="send" size={15} /> Publish</button>
			</form>
		{/if}
	</div>
</header>

{#if e.status === 'draft'}
	<div class="alert alert-warn" style="margin-bottom: 20px">
		<Icon name="eye" size={18} />
		<p>This event is a <strong>draft</strong>. Add shifts, then publish it to open sign-ups.</p>
	</div>
{/if}

<div class="layout">
	<div class="stack" style="--gap: 24px">
		<section aria-labelledby="shifts-heading">
			<div class="section-title">
				<h2 id="shifts-heading">Shifts</h2>
				<div class="row" style="--gap: 12px">
					{#if totals.capacity}<span class="small muted tabular"
							>{totals.filled}/{totals.capacity} upcoming spots filled</span
						>{/if}
					{#if data.pastCount}
						<a class="small" href={data.showPast ? '?' : '?past=1'}
							>{data.showPast ? 'Hide past' : `Show ${plural(data.pastCount, 'past shift')}`}</a
						>
					{/if}
				</div>
			</div>
			{#if days.length === 0}
				<div class="card empty">
					<h3>No upcoming shifts</h3>
					<p>Add the first one below. Use “Repeat” to create a whole season at once.</p>
				</div>
			{:else}
				<div class="stack" style="--gap: 16px">
					{#each days as day (day.key)}
						<div class="card">
							<div class="card-header day-head">
								<h3>{f.day(day.first, true)}</h3>
								<span class="subtle small">{f.relative(day.first, data.now)}</span>
							</div>
							<ul class="list-plain">
								{#each day.shifts as s (s.id)}
									<li>
										<a class="shift-row" class:past={s.past} href="/admin/shifts/{s.id}">
											<span class="time tabular">{f.range(s.startsAt, s.endsAt)}</span>
											<span class="grow role">
												<span class="strong">{s.role}</span>
												{#if s.coverNeeded}<span class="badge badge-amber"
														>{s.coverNeeded} needs cover</span
													>{/if}
												{#if s.location}<span class="small subtle">· {s.location}</span>{/if}
											</span>
											<FillMeter filled={s.filled} capacity={s.capacity} compact />
											<Icon name="chevron-right" size={16} />
										</a>
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<section id="add-shifts" class="card" aria-labelledby="add-heading">
			<div class="card-header"><h2 id="add-heading">Add shifts</h2></div>
			<form method="POST" action="?/addShifts" use:enhance>
				<div class="card-body">
					<ShiftFields
						values={form?.shiftForm?.values ?? data.defaults}
						errors={form?.shiftForm?.errors}
						allowRepeat
						roles={data.roles}
						idPrefix="add"
					/>
				</div>
				<div class="card-footer form-actions">
					<button class="btn btn-primary"><Icon name="plus" size={16} /> Add shift</button>
					<span class="hint">Times are in {data.org.timezone.replace(/_/g, ' ')}.</span>
				</div>
			</form>
		</section>
	</div>

	<aside class="stack" style="--gap: 20px">
		<section class="card card-body stack" style="--gap: 10px">
			<h2 style="font-size: 1rem">Share the sign-up page</h2>
			<CopyField value={data.publicUrl} label="Public sign-up link" />
			<p class="hint">
				Post it in your group chat, newsletter or website. No account needed to sign up.
			</p>
		</section>

		<section class="card" aria-labelledby="details-heading">
			<div class="card-header"><h2 id="details-heading">Event details</h2></div>
			<form method="POST" action="?/update" use:enhance>
				<div class="card-body">
					<EventFields
						values={form?.eventForm?.values ?? e}
						errors={form?.eventForm?.errors}
						compact
					/>
				</div>
				<div class="card-footer form-actions">
					<button class="btn btn-primary btn-sm">Save details</button>
				</div>
			</form>
		</section>

		<section class="card card-body stack" style="--gap: 10px">
			<h2 style="font-size: 1rem">Danger zone</h2>
			{#if e.status !== 'archived'}
				<form method="POST" action="?/status" use:enhance>
					<input type="hidden" name="status" value="archived" />
					<button class="btn btn-sm btn-block">Archive event</button>
				</form>
			{/if}
			<form
				method="POST"
				action="?/delete"
				use:enhance={confirmFirst(
					`Delete “${e.title}” and all its shifts? Volunteers with upcoming shifts will be emailed. Hours from this event will be lost. This can’t be undone.`
				)}
			>
				<button class="btn btn-sm btn-danger btn-block"
					><Icon name="trash" size={15} /> Delete event</button
				>
			</form>
			<p class="hint">Archiving keeps history and hours. Deleting removes everything.</p>
		</section>
	</aside>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 24px;
	}
	@media (min-width: 1180px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 360px;
			align-items: start;
		}
	}
	.day-head {
		padding: 12px 20px;
		background: var(--surface-2);
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
	}
	.day-head h3 {
		font-size: 0.95rem;
	}
	li + li .shift-row {
		border-top: 1px solid var(--border);
	}
	.shift-row {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 20px;
		color: inherit;
		text-decoration: none;
	}
	.shift-row:hover {
		background: var(--surface-2);
	}
	.shift-row.past {
		opacity: 0.6;
	}
	.shift-row :global(svg) {
		color: var(--text-3);
		flex: none;
	}
	.time {
		width: 150px;
		flex: none;
		font-weight: 600;
		font-size: 0.9rem;
	}
	.role {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	li:last-child .shift-row {
		border-radius: 0 0 var(--radius-lg) var(--radius-lg);
	}
	@media (max-width: 640px) {
		.shift-row {
			flex-wrap: wrap;
			gap: 6px 12px;
		}
		.time {
			width: auto;
		}
		.role {
			flex-basis: 100%;
			order: -1;
		}
	}
</style>
