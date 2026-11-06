<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { formatter, initials, plural } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const f = $derived(formatter(data.org));
	const pageHref = (p: number) =>
		`?${new URLSearchParams({ ...(data.q ? { q: data.q } : {}), page: String(p) })}`;
</script>

<svelte:head>
	<title>Volunteers · {data.org.name}</title>
</svelte:head>

<header class="page-header">
	<div>
		<h1>Volunteers</h1>
		<p>
			{plural(data.total, 'person', 'people')}
			{data.q ? `matching “${data.q}”` : 'have signed up so far'}.
		</p>
	</div>
	<a class="btn" href="/admin/volunteers/export" download
		><Icon name="download" size={16} /> Export CSV</a
	>
</header>

<form method="GET" class="search" role="search">
	<Icon name="search" size={18} />
	<label for="q" class="sr-only">Search volunteers</label>
	<input
		id="q"
		name="q"
		type="search"
		placeholder="Search by name, email or phone"
		value={data.q}
	/>
	<button class="btn">Search</button>
</form>

{#if data.volunteers.length === 0}
	<div class="card empty">
		<h3>{data.q ? 'No matches' : 'No volunteers yet'}</h3>
		<p>
			{data.q
				? 'Try a different search.'
				: 'People appear here as soon as they sign up for a shift.'}
		</p>
	</div>
{:else}
	<div class="card table-wrap">
		<table class="table">
			<thead>
				<tr>
					<th>Name</th>
					<th>Contact</th>
					<th class="num">Upcoming</th>
					<th class="num">Completed</th>
					<th class="num">Hours</th>
					<th>Last shift</th>
				</tr>
			</thead>
			<tbody>
				{#each data.volunteers as v (v.id)}
					<tr>
						<td>
							<a href="/admin/volunteers/{v.id}" class="person">
								<span class="avatar">{initials(v.name)}</span>
								<span class="strong">{v.name}</span>
							</a>
						</td>
						<td class="small">
							<div>{v.email}</div>
							{#if v.phone}<div class="subtle">{v.phone}</div>{/if}
						</td>
						<td class="num">{v.upcoming || '–'}</td>
						<td class="num">
							{v.completed || '–'}
							{#if v.noShows}<span class="badge badge-red" title="No-shows">{v.noShows} missed</span
								>{/if}
						</td>
						<td class="num strong">{v.hours ? Math.round(v.hours * 10) / 10 : '–'}</td>
						<td class="small nowrap">{v.lastShiftAt ? f.date(v.lastShiftAt, true) : '–'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if data.pages > 1}
		<nav class="row pager" aria-label="Pages">
			{#if data.page > 1}<a class="btn btn-sm" href={pageHref(data.page - 1)}
					><Icon name="chevron-left" size={15} /> Previous</a
				>{/if}
			<span class="small muted">Page {data.page} of {data.pages}</span>
			{#if data.page < data.pages}<a class="btn btn-sm" href={pageHref(data.page + 1)}
					>Next <Icon name="chevron-right" size={15} /></a
				>{/if}
		</nav>
	{/if}
{/if}

<style>
	.search {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
		max-width: 560px;
		position: relative;
	}
	.search :global(svg) {
		position: absolute;
		left: 12px;
		color: var(--text-3);
		pointer-events: none;
	}
	.search input {
		padding-left: 38px;
	}
	.person {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--text);
		text-decoration: none;
	}
	.person:hover .strong {
		text-decoration: underline;
	}
	.pager {
		justify-content: center;
		margin-top: 16px;
	}
	.badge {
		margin-left: 6px;
	}
</style>
