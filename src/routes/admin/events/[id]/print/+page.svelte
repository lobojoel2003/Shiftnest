<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { formatter } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const f = $derived(formatter(data.org));
</script>

<svelte:head>
	<title>Roster · {data.event.title}</title>
</svelte:head>

<div class="no-print row between" style="margin-bottom: 20px">
	<a href="/admin/events/{data.event.id}" class="back-link" style="margin: 0"
		><Icon name="arrow-left" size={16} /> {data.event.title}</a
	>
	<button class="btn btn-primary" onclick={() => print()}
		><Icon name="printer" size={16} /> Print</button
	>
</div>

<div class="sheet">
	<h1>{data.event.title}</h1>
	<p class="muted">{data.org.name}{data.event.location ? ` · ${data.event.location}` : ''}</p>

	{#each data.shifts as s (s.id)}
		<section class="shift">
			<h2>
				{f.date(s.startsAt, true)} · {f.range(s.startsAt, s.endsAt)} · {s.role}
				<span class="subtle">({s.people.length}/{s.capacity})</span>
			</h2>
			<table class="table">
				<thead
					><tr><th style="width: 36px">✓</th><th>Name</th><th>Phone</th><th>Note</th></tr></thead
				>
				<tbody>
					{#each s.people as p (p.id)}
						<tr
							><td><span class="box"></span></td><td>{p.name}</td><td class="nowrap">{p.phone}</td
							><td class="small">{p.note}</td></tr
						>
					{/each}
					{#each Array.from({ length: Math.max(0, Math.min(3, s.capacity - s.people.length)) }, (_, i) => i) as i (i)}
						<tr class="blank"><td><span class="box"></span></td><td></td><td></td><td></td></tr>
					{/each}
				</tbody>
			</table>
		</section>
	{:else}
		<p class="muted">No upcoming shifts.</p>
	{/each}
</div>

<style>
	.sheet {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 32px;
	}
	.sheet h1 {
		font-size: 1.5rem;
	}
	.shift {
		margin-top: 24px;
		break-inside: avoid;
	}
	.shift h2 {
		font-size: 1rem;
		margin-bottom: 8px;
	}
	.box {
		display: inline-block;
		width: 16px;
		height: 16px;
		border: 1.5px solid var(--text-3);
		border-radius: 4px;
	}
	.blank td {
		height: 38px;
	}
	.table th {
		background: transparent;
	}
	@media print {
		.sheet {
			border: 0;
			padding: 0;
		}
		.table td,
		.table th {
			border-bottom: 1px solid #bbb;
		}
	}
</style>
