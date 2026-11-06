<script lang="ts">
	import FillMeter from '#lib/components/FillMeter.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { formatter, initials } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const f = $derived(formatter(data.org));
	const fillRate = $derived(
		data.stats.capacityThisWeek
			? Math.round((data.stats.filledThisWeek / data.stats.capacityThisWeek) * 100)
			: 0
	);
	const greeting = $derived.by(() => {
		const hour = Number(
			new Intl.DateTimeFormat('en-US', {
				hour: 'numeric',
				hourCycle: 'h23',
				timeZone: data.org.timezone
			}).format(data.now)
		);
		return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
	});

	function ago(ms: number) {
		const mins = Math.round((data.now - ms) / 60_000);
		if (mins < 60) return `${Math.max(1, mins)}m ago`;
		const hours = Math.round(mins / 60);
		if (hours < 48) return `${hours}h ago`;
		return `${Math.round(hours / 24)}d ago`;
	}
</script>

<svelte:head>
	<title>Dashboard · {data.org.name}</title>
</svelte:head>

<header class="page-header">
	<div>
		<h1>{greeting}, {data.user.name.split(' ')[0]}</h1>
		<p>Here’s what’s happening over the next week.</p>
	</div>
	<a class="btn btn-primary" href="/admin/events/new"><Icon name="plus" size={16} /> New event</a>
</header>

<div class="stats">
	<div class="card stat">
		<span class="label"><Icon name="calendar" size={16} /> Shifts this week</span>
		<span class="value tabular">{data.stats.shiftsThisWeek}</span>
		<span class="sub">{fillRate}% of spots filled</span>
	</div>
	<div class="card stat" class:warn={data.stats.openSpotsThisWeek > 0}>
		<span class="label"><Icon name="alert" size={16} /> Open spots this week</span>
		<span class="value tabular">{data.stats.openSpotsThisWeek}</span>
		<span class="sub"
			>{data.stats.openSpotsThisWeek ? 'Share your sign-up page' : 'Fully staffed'}</span
		>
	</div>
	<div class="card stat">
		<span class="label"><Icon name="users" size={16} /> Volunteers</span>
		<span class="value tabular">{data.stats.volunteers}</span>
		<span class="sub"><a href="/admin/volunteers">View all</a></span>
	</div>
	<div class="card stat">
		<span class="label"><Icon name="clock" size={16} /> Hours this month</span>
		<span class="value tabular">{Math.round(data.stats.hoursThisMonth)}</span>
		<span class="sub"><a href="/admin/hours">Hours report</a></span>
	</div>
</div>

<div class="grid-2">
	<section class="card">
		<div class="card-header">
			<h2>Needs volunteers</h2>
			<span class="subtle small">Next 14 days</span>
		</div>
		{#if data.needs.length === 0}
			<div class="empty small">
				<Icon name="check-circle" size={28} class="ok" />
				<p>Every shift in the next two weeks is covered.</p>
			</div>
		{:else}
			<ul class="list-plain rows">
				{#each data.needs as s (s.id)}
					<li>
						<a href="/admin/shifts/{s.id}" class="row-link">
							<div class="grow" style="min-width: 0">
								<p class="strong truncate">
									{s.role} <span class="subtle small">· {s.eventTitle}</span>
								</p>
								<p class="small muted">
									{f.relative(s.startsAt, data.now)} · {f.date(s.startsAt)}, {f.range(
										s.startsAt,
										s.endsAt
									)}
								</p>
								{#if s.coverNeeded}<span class="badge badge-amber" style="margin-top: 4px"
										>{s.coverNeeded} needs cover</span
									>{/if}
							</div>
							<FillMeter filled={s.filled} capacity={s.capacity} compact />
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<div class="stack" style="--gap: 20px">
		<section class="card">
			<div class="card-header">
				<h2>Cover requests</h2>
				{#if data.swaps.length}<span class="badge badge-amber">{data.swaps.length} open</span>{/if}
			</div>
			{#if data.swaps.length === 0}
				<div class="empty small"><p>No one is looking for cover right now.</p></div>
			{:else}
				<ul class="list-plain rows">
					{#each data.swaps as s (s.id)}
						<li>
							<a href="/admin/shifts/{s.shiftId}" class="row-link">
								<span class="avatar">{initials(s.volunteerName)}</span>
								<div class="grow" style="min-width: 0">
									<p class="truncate"><span class="strong">{s.volunteerName}</span> needs cover</p>
									<p class="small muted">{s.role} · {f.date(s.startsAt)}, {f.time(s.startsAt)}</p>
								</div>
								<Icon name="chevron-right" size={16} />
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="card">
			<div class="card-header"><h2>Recent sign-ups</h2></div>
			{#if data.recent.length === 0}
				<div class="empty small"><p>Sign-ups will appear here as they come in.</p></div>
			{:else}
				<ul class="list-plain rows">
					{#each data.recent as s (s.id)}
						<li>
							<a href="/admin/shifts/{s.shiftId}" class="row-link">
								<span class="avatar">{initials(s.volunteerName)}</span>
								<div class="grow" style="min-width: 0">
									<p class="truncate">
										<span class="strong">{s.volunteerName}</span>
										<span class="muted">signed up for {s.role}</span>
									</p>
									<p class="small subtle">{f.date(s.startsAt)} · {ago(s.createdAt)}</p>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</div>

<style>
	.stats {
		display: grid;
		gap: 14px;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		margin-bottom: 24px;
	}
	.stat {
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.stat .label {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-2);
	}
	.stat .label :global(svg) {
		color: var(--accent-text);
	}
	.stat.warn .label :global(svg) {
		color: var(--amber);
	}
	.stat .value {
		font-size: 2rem;
		font-weight: 750;
		letter-spacing: -0.03em;
		margin-top: 4px;
	}
	.stat .sub {
		font-size: 0.82rem;
		color: var(--text-3);
	}
	.grid-2 {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 20px;
	}
	@media (min-width: 1100px) {
		.grid-2 {
			grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
			align-items: start;
		}
	}
	.rows li + li {
		border-top: 1px solid var(--border);
	}
	.row-link {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 13px 20px;
		color: inherit;
		text-decoration: none;
	}
	.row-link:hover {
		background: var(--surface-2);
	}
	.row-link :global(svg) {
		color: var(--text-3);
	}
	.rows li:last-child .row-link {
		border-radius: 0 0 var(--radius-lg) var(--radius-lg);
	}
	.empty :global(.ok) {
		margin: 0 auto 8px;
		color: var(--green);
	}
</style>
