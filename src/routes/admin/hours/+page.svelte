<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const round = (n: number) => Math.round(n * 10) / 10;
	const max = $derived(Math.max(1, ...data.byVolunteer.map((v) => v.hours)));
	const qs = $derived(`from=${data.from}&to=${data.to}`);
	const volunteers = $derived(data.byVolunteer.length);
</script>

<svelte:head>
	<title>Hours · {data.org.name}</title>
</svelte:head>

<header class="page-header">
	<div>
		<h1>Volunteer hours</h1>
		<p>Totals for grant reports, thank-you notes and service-hour letters.</p>
	</div>
	<div class="row" style="--gap: 8px">
		<a class="btn btn-sm" href="/admin/hours/export?{qs}&kind=volunteers" download
			><Icon name="download" size={15} /> Totals CSV</a
		>
		<a class="btn btn-sm" href="/admin/hours/export?{qs}&kind=entries" download
			><Icon name="download" size={15} /> Every shift CSV</a
		>
	</div>
</header>

<div class="card card-body filters">
	<div class="row" style="--gap: 6px">
		{#each data.presets as p (p.key)}
			<a
				class="chip"
				href="?from={p.from}&to={p.to}"
				aria-current={p.from === data.from && p.to === data.to ? 'true' : undefined}>{p.label}</a
			>
		{/each}
	</div>
	<form method="GET" class="row" style="--gap: 8px">
		<label class="sr-only" for="from">From</label>
		<input id="from" name="from" type="date" value={data.from} />
		<span class="subtle">to</span>
		<label class="sr-only" for="to">To</label>
		<input id="to" name="to" type="date" value={data.to} />
		<button class="btn btn-sm">Apply</button>
	</form>
</div>

<div class="stats">
	<div class="card stat">
		<span class="value tabular">{round(data.total.hours)}</span><span class="label">Hours</span>
	</div>
	<div class="card stat">
		<span class="value tabular">{data.total.shifts}</span><span class="label">Shifts worked</span>
	</div>
	<div class="card stat">
		<span class="value tabular">{volunteers}</span><span class="label">Volunteers</span>
	</div>
	<div class="card stat">
		<span class="value tabular">{volunteers ? round(data.total.hours / volunteers) : 0}</span><span
			class="label">Hours per volunteer</span
		>
	</div>
</div>

{#if data.assumeAttendance}
	<p class="hint" style="margin: -8px 0 16px">
		Past shifts nobody marked count as worked; no-shows don’t. Change this in <a
			href="/admin/settings">Settings</a
		>.
	</p>
{/if}

<div class="layout">
	<section class="card">
		<div class="card-header"><h2>By volunteer</h2></div>
		{#if data.byVolunteer.length === 0}
			<div class="empty small"><p>No hours in this period yet.</p></div>
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead
						><tr
							><th>Volunteer</th><th class="num">Shifts</th><th class="num">Hours</th><th
								style="width: 30%"><span class="sr-only">Share</span></th
							></tr
						></thead
					>
					<tbody>
						{#each data.byVolunteer as v (v.volunteer_id)}
							<tr>
								<td><a href="/admin/volunteers/{v.volunteer_id}" class="strong">{v.name}</a></td>
								<td class="num">{v.shifts}</td>
								<td class="num strong">{round(v.hours)}</td>
								<td
									><div class="meter"><span style:width="{(v.hours / max) * 100}%"></span></div></td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
	<section class="card">
		<div class="card-header"><h2>By event</h2></div>
		{#if data.byEvent.length === 0}
			<div class="empty small"><p>Nothing yet.</p></div>
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead><tr><th>Event</th><th class="num">People</th><th class="num">Hours</th></tr></thead
					>
					<tbody>
						{#each data.byEvent as e (e.event_id)}
							<tr>
								<td><a href="/admin/events/{e.event_id}" class="strong">{e.title}</a></td>
								<td class="num">{e.volunteers}</td>
								<td class="num strong">{round(e.hours)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 20px;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
		padding: 14px 18px;
	}
	.filters input {
		width: auto;
		min-height: 34px;
		padding: 5px 10px;
	}
	.chip {
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		padding: 4px 12px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-2);
		text-decoration: none;
	}
	.chip[aria-current='true'] {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-contrast);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 12px;
		margin-bottom: 20px;
	}
	.stat {
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
	}
	.stat .value {
		font-size: 1.8rem;
		font-weight: 750;
		letter-spacing: -0.02em;
	}
	.stat .label {
		font-size: 0.84rem;
		color: var(--text-2);
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 20px;
	}
	@media (min-width: 1100px) {
		.layout {
			grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
			align-items: start;
		}
	}
</style>
