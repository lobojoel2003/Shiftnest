<script lang="ts">
	import FillMeter from '#lib/components/FillMeter.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import { formatter } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const f = $derived(formatter(data.org));
	const tabs = [
		['active', 'Active'],
		['published', 'Published'],
		['draft', 'Drafts'],
		['archived', 'Archived']
	] as const;
</script>

<svelte:head>
	<title>Events · {data.org.name}</title>
</svelte:head>

<header class="page-header">
	<div>
		<h1>Events & shifts</h1>
		<p>Each event is a sign-up page with one or more shifts.</p>
	</div>
	<a class="btn btn-primary" href="/admin/events/new"><Icon name="plus" size={16} /> New event</a>
</header>

<nav class="tabs" aria-label="Filter events">
	{#each tabs as [key, label] (key)}
		<a href="?status={key}" aria-current={data.status === key ? 'page' : undefined}>
			{label} <span class="subtle">{data.counts[key]}</span>
		</a>
	{/each}
</nav>

{#if data.events.length === 0}
	<div class="card empty">
		<Icon name="calendar" size={32} class="muted-icon" />
		<h3>{data.status === 'active' ? 'No events yet' : 'Nothing here'}</h3>
		<p>
			Create an event (like “Saturday Food Distribution”), then add shifts people can sign up for.
		</p>
		<p style="margin-top: 16px">
			<a class="btn btn-primary" href="/admin/events/new"
				><Icon name="plus" size={16} /> Create your first event</a
			>
		</p>
	</div>
{:else}
	<div class="card table-wrap">
		<table class="table">
			<thead>
				<tr
					><th>Event</th><th>Status</th><th>Next shift</th><th class="num">Upcoming</th><th
						>Spots</th
					></tr
				>
			</thead>
			<tbody>
				{#each data.events as e (e.id)}
					<tr>
						<td>
							<a href="/admin/events/{e.id}" class="strong">{e.title}</a>
							{#if e.location}<p class="small subtle">{e.location}</p>{/if}
						</td>
						<td><StatusBadge status={e.status} /></td>
						<td class="nowrap">
							{#if e.nextStart}{f.date(e.nextStart)}
								<span class="subtle small">· {f.relative(e.nextStart, data.now)}</span>{:else}<span
									class="subtle">None scheduled</span
								>{/if}
						</td>
						<td class="num">{e.upcomingShifts}</td>
						<td style="min-width: 150px"
							>{#if e.capacity}<FillMeter filled={e.filled} capacity={e.capacity} />{:else}<span
									class="subtle">–</span
								>{/if}</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.empty :global(.muted-icon) {
		margin: 0 auto 12px;
		color: var(--text-3);
	}
</style>
