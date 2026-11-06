<script lang="ts">
	import FillMeter from '#lib/components/FillMeter.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { formatter, plural } from '#lib/format.ts';
	import { dayKey } from '#lib/time.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const f = $derived(formatter(data.org));

	const roles = $derived([...new Set(data.shifts.map((s) => s.role))].sort());
	let role = $state<string | null>(null);
	let onlyOpen = $state(false);

	const visible = $derived(
		data.shifts.filter(
			(s) =>
				(!role || s.role === role) && (!onlyOpen || s.filled < s.capacity || s.coverToken || s.mine)
		)
	);

	const days = $derived.by(() => {
		const groups: { key: string; first: number; shifts: typeof visible }[] = [];
		for (const s of visible) {
			const key = dayKey(s.startsAt, data.org.timezone);
			let group = groups.at(-1);
			if (!group || group.key !== key) {
				group = { key, first: s.startsAt, shifts: [] };
				groups.push(group);
			}
			group.shifts.push(s);
		}
		return groups;
	});

	const feedUrl = $derived(`${data.origin}/ical/events/${data.event.slug}.ics`);
	const webcalUrl = $derived(feedUrl.replace(/^https?:/, 'webcal:'));
</script>

<svelte:head>
	<title>{data.event.title} · {data.org.name}</title>
	<meta name="description" content={data.event.summary || data.org.tagline} />
</svelte:head>

<div class="container page">
	<a href="/" class="back-link"><Icon name="arrow-left" size={16} /> All opportunities</a>

	{#if data.event.status === 'draft'}
		<div class="alert alert-warn" style="margin-bottom: 16px">
			<Icon name="eye" size={18} />
			<p>Preview: this event is a draft, so only coordinators can see it.</p>
		</div>
	{/if}

	<header class="card event-header">
		<div class="card-body stack" style="--gap: 12px">
			<h1>{data.event.title}</h1>
			{#if data.event.summary}<p class="summary">{data.event.summary}</p>{/if}
			{#if data.event.location}
				<p class="icon-text muted"><Icon name="pin" size={17} />{data.event.location}</p>
			{/if}
			{#if data.event.description}
				<p class="pre-line description">{data.event.description}</p>
			{/if}
			{#if data.event.status === 'published'}
				<div class="row" style="--gap: 8px">
					<a class="btn btn-sm" href={webcalUrl}
						><Icon name="feed" size={15} /> Subscribe in your calendar</a
					>
					<a class="btn btn-sm btn-ghost" href={feedUrl} download
						><Icon name="download" size={15} /> .ics</a
					>
				</div>
			{/if}
		</div>
	</header>

	{#if data.event.status === 'archived'}
		<div class="card empty">
			<h3>This event has wrapped up</h3>
			<p>Thank you to everyone who helped! <a href="/">See what’s coming up next.</a></p>
		</div>
	{:else if data.shifts.length === 0}
		<div class="card empty">
			<h3>No upcoming shifts</h3>
			<p>All shifts for this event have passed. <a href="/">See other opportunities.</a></p>
		</div>
	{:else}
		<div class="filters row between">
			<div class="row chips" style="--gap: 6px" role="group" aria-label="Filter by role">
				{#if roles.length > 1}
					<button
						type="button"
						class="chip"
						aria-pressed={role === null}
						onclick={() => (role = null)}>All roles</button
					>
					{#each roles as r (r)}
						<button
							type="button"
							class="chip"
							aria-pressed={role === r}
							onclick={() => (role = role === r ? null : r)}>{r}</button
						>
					{/each}
				{/if}
			</div>
			<label class="check small">
				<input type="checkbox" bind:checked={onlyOpen} /> Only show shifts with open spots
			</label>
		</div>

		{#if days.length === 0}
			<div class="card empty"><p>No shifts match those filters.</p></div>
		{/if}

		{#each days as day (day.key)}
			<section class="day" aria-labelledby="day-{day.key}">
				<h2 id="day-{day.key}" class="day-title">
					{f.day(day.first)}
					<span class="subtle small">{f.relative(day.first, data.now)}</span>
				</h2>
				<ul class="card list-plain shifts">
					{#each day.shifts as shift (shift.id)}
						{@const full = shift.filled >= shift.capacity}
						<li class="shift" id="shift-{shift.id}" class:mine={shift.mine}>
							<div class="time tabular">
								<span class="strong">{f.time(shift.startsAt)}</span>
								<span class="subtle small">to {f.time(shift.endsAt)}</span>
							</div>
							<div class="info grow">
								<div class="row" style="--gap: 8px">
									<h3>{shift.role}</h3>
									{#if shift.mine}<span class="badge badge-green"
											><Icon name="check" size={13} /> You’re signed up</span
										>{/if}
									{#if shift.coverToken}<span class="badge badge-amber">Needs cover</span>{/if}
								</div>
								{#if shift.location && shift.location !== data.event.location}
									<p class="icon-text small muted"><Icon name="pin" size={14} />{shift.location}</p>
								{/if}
								{#if shift.notes}<p class="small muted">{shift.notes}</p>{/if}
							</div>
							<div class="meter-col">
								<FillMeter filled={shift.filled} capacity={shift.capacity} />
							</div>
							<div class="action">
								{#if shift.mine}
									<a class="btn btn-sm" href="/my">Manage</a>
								{:else if shift.started}
									<span class="badge">In progress</span>
								{:else if !full && data.event.status === 'published'}
									<div class="action-stack">
										<a class="btn btn-sm btn-primary" href="/events/{data.event.slug}/{shift.id}">
											Sign up <span class="sr-only"
												>for {shift.role}, {f.when(shift.startsAt, shift.endsAt)}</span
											>
										</a>
										{#if shift.coverToken}
											<a class="small" href="/swap/{shift.coverToken}">or cover for someone</a>
										{/if}
									</div>
								{:else if shift.coverToken}
									<a class="btn btn-sm btn-primary" href="/swap/{shift.coverToken}"
										>Take this shift</a
									>
								{:else if full}
									<span class="btn btn-sm" aria-disabled="true">Full</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
		<p class="subtle small center" style="margin-top: 24px">
			{plural(data.shifts.length, 'upcoming shift')} · Times shown in {data.org.timezone.replace(
				/_/g,
				' '
			)}
		</p>
	{/if}
</div>

<style>
	.event-header {
		margin-bottom: 24px;
		background:
			radial-gradient(600px 200px at 100% 0%, var(--accent-soft), transparent 70%), var(--surface);
	}
	.summary {
		font-size: 1.08rem;
		color: var(--text-2);
	}
	.description {
		max-width: 70ch;
		color: var(--text-2);
	}
	.filters {
		margin-bottom: 8px;
		--gap: 12px;
	}
	.chip {
		border: 1px solid var(--border-strong);
		background: var(--surface);
		color: var(--text-2);
		border-radius: 999px;
		padding: 5px 12px;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
	}
	.chip[aria-pressed='true'] {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-contrast);
	}
	.day {
		margin-top: 22px;
	}
	.day-title {
		font-size: 1rem;
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 10px;
	}
	.shift {
		display: grid;
		grid-template-columns: 92px minmax(0, 1fr) 150px 140px;
		gap: 16px;
		align-items: center;
		padding: 16px 20px;
	}
	.shift + .shift {
		border-top: 1px solid var(--border);
	}
	.shift.mine {
		background: linear-gradient(90deg, var(--green-soft), transparent 40%);
	}
	.shift:first-child {
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
	}
	.shift:last-child {
		border-radius: 0 0 var(--radius-lg) var(--radius-lg);
	}
	.shift:only-child {
		border-radius: var(--radius-lg);
	}
	.shift:target {
		box-shadow: inset 3px 0 0 var(--accent);
	}
	.time {
		display: flex;
		flex-direction: column;
	}
	.info h3 {
		font-size: 1rem;
	}
	.info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.action {
		display: flex;
		justify-content: flex-end;
	}
	.action-stack {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}
	@media (max-width: 760px) {
		.shift {
			grid-template-columns: 72px minmax(0, 1fr);
			gap: 10px 14px;
		}
		.meter-col {
			grid-column: 2;
		}
		.action {
			grid-column: 2;
			justify-content: flex-start;
		}
		.action-stack {
			flex-direction: row;
			align-items: center;
			gap: 12px;
		}
	}
</style>
