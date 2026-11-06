<script lang="ts">
	import DateBadge from '#lib/components/DateBadge.svelte';
	import FillMeter from '#lib/components/FillMeter.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { formatter, plural } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const f = $derived(formatter(data.org));
</script>

<svelte:head>
	<title>Volunteer with {data.org.name}</title>
	<meta name="description" content={data.org.tagline} />
</svelte:head>

<section class="hero">
	<div class="container">
		<p class="eyebrow">Volunteer sign-up</p>
		<h1>Help out with {data.org.name}</h1>
		{#if data.org.tagline}<p class="lead">{data.org.tagline}</p>{/if}
		<div class="row hero-actions">
			<a href="#opportunities" class="btn btn-primary btn-lg"
				>Find a shift <Icon name="arrow-right" size={18} /></a
			>
			<a href="/my" class="btn btn-lg">
				<Icon name="user" size={18} />
				{data.volunteer ? 'My shifts' : 'I already signed up'}
			</a>
		</div>
		<ul class="perks list-plain row">
			<li><Icon name="mail" size={16} /> Free email reminders</li>
			<li><Icon name="swap" size={16} /> Swap or switch anytime</li>
			<li><Icon name="calendar" size={16} /> Syncs with your calendar</li>
		</ul>
	</div>
</section>

<div class="container page" id="opportunities">
	<div class="layout">
		<section aria-labelledby="events-heading">
			<div class="section-title">
				<h2 id="events-heading">Opportunities</h2>
				<span class="subtle small">{plural(data.events.length, 'event')}</span>
			</div>

			{#if data.events.length === 0}
				<div class="card empty">
					<Icon name="calendar" size={32} class="empty-icon" />
					<h3>No shifts are open right now</h3>
					<p>Check back soon. New shifts are added regularly.</p>
				</div>
			{:else}
				<div class="stack" style="--gap: 14px">
					{#each data.events as event (event.id)}
						<a class="card event-card" href="/events/{event.slug}">
							{#if event.nextStart}
								<DateBadge {...f.badge(event.nextStart)} />
							{/if}
							<div class="grow stack" style="--gap: 6px">
								<h3>{event.title}</h3>
								{#if event.summary}<p class="muted small">{event.summary}</p>{/if}
								<p class="meta small subtle row" style="--gap: 4px 14px">
									{#if event.location}
										<span class="icon-text"><Icon name="pin" size={15} />{event.location}</span>
									{/if}
									<span class="icon-text"
										><Icon name="clock" size={15} />{plural(event.upcomingShifts, 'shift')} coming up</span
									>
								</p>
							</div>
							<div class="side">
								<FillMeter filled={event.filled} capacity={event.capacity} />
								<span class="btn btn-soft btn-sm"
									>View shifts <Icon name="chevron-right" size={15} /></span
								>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</section>

		{#if data.soon.length}
			<aside aria-labelledby="soon-heading">
				<div class="section-title">
					<h2 id="soon-heading">Needs people soon</h2>
				</div>
				<ul class="card list-plain soon">
					{#each data.soon as shift (shift.id)}
						<li>
							<a href="/events/{shift.eventSlug}#shift-{shift.id}">
								<span class="strong">{shift.role}</span>
								<span class="small muted">{shift.eventTitle}</span>
								<span class="small subtle"
									>{f.relative(shift.startsAt, data.now)} · {f.range(
										shift.startsAt,
										shift.endsAt
									)}</span
								>
								<span class="row" style="--gap: 6px; margin-top: 4px">
									{#if shift.open > 0}<span class="badge badge-accent">{shift.open} open</span>{/if}
									{#if shift.coverNeeded > 0}<span class="badge badge-amber">Needs cover</span>{/if}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</aside>
		{/if}
	</div>
</div>

<style>
	.hero {
		padding: 56px 0 44px;
		background:
			radial-gradient(1200px 400px at 10% -10%, var(--accent-soft), transparent 70%),
			radial-gradient(800px 300px at 100% 0%, var(--amber-soft), transparent 70%);
		border-bottom: 1px solid var(--border);
	}
	.hero h1 {
		max-width: 22ch;
		margin-top: 8px;
		font-size: clamp(1.9rem, 1.3rem + 2.4vw, 3rem);
	}
	.lead {
		margin-top: 14px;
		max-width: 60ch;
		font-size: 1.08rem;
		color: var(--text-2);
	}
	.hero-actions {
		margin-top: 24px;
	}
	.perks {
		margin-top: 22px;
		--gap: 8px 20px;
		color: var(--text-2);
		font-size: 0.9rem;
	}
	.perks li {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.perks :global(svg) {
		color: var(--accent-text);
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 32px;
	}
	@media (min-width: 960px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 320px;
			align-items: start;
		}
		aside {
			position: sticky;
			top: calc(var(--header-h) + 20px);
		}
	}
	.event-card {
		display: flex;
		gap: 18px;
		align-items: center;
		padding: 18px 20px;
		color: inherit;
		text-decoration: none;
		transition:
			border-color 0.15s,
			box-shadow 0.15s,
			transform 0.15s;
	}
	.event-card:hover {
		border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
		box-shadow: var(--shadow);
		transform: translateY(-1px);
	}
	.event-card h3 {
		font-size: 1.1rem;
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 12px;
		align-items: flex-end;
		flex: none;
	}
	@media (max-width: 640px) {
		.event-card {
			flex-wrap: wrap;
			align-items: flex-start;
		}
		.side {
			width: 100%;
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
		}
	}
	.soon li + li {
		border-top: 1px solid var(--border);
	}
	.soon a {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding: 14px 18px;
		color: inherit;
		text-decoration: none;
	}
	.soon a:hover {
		background: var(--surface-2);
	}
	.soon li:first-child a {
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
	}
	.soon li:last-child a {
		border-radius: 0 0 var(--radius-lg) var(--radius-lg);
	}
	.empty :global(.empty-icon) {
		margin: 0 auto 12px;
		color: var(--text-3);
	}
</style>
