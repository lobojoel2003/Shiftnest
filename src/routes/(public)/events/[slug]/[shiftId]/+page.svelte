<script lang="ts">
	import { enhance } from '$app/forms';
	import FillMeter from '#lib/components/FillMeter.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PersonFields from '#lib/components/PersonFields.svelte';
	import { pending } from '#lib/enhance.ts';
	import { formatter } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const f = $derived(formatter(data.org));
	const s = $derived(data.shift);
	const full = $derived(s.filled >= s.capacity);
	let busy = $state(false);
</script>

<svelte:head>
	<title>Sign up: {s.role} · {data.org.name}</title>
</svelte:head>

<div class="container narrow page">
	<a href="/events/{s.eventSlug}" class="back-link"
		><Icon name="arrow-left" size={16} /> {s.eventTitle}</a
	>

	<div class="card">
		<div class="card-body stack" style="--gap: 18px">
			<div class="stack" style="--gap: 6px">
				<p class="eyebrow">Sign up for a shift</p>
				<h1>{s.role}</h1>
				<p class="muted">{s.eventTitle}</p>
			</div>

			<dl class="facts">
				<div>
					<dt><Icon name="calendar" size={17} /><span class="sr-only">Date</span></dt>
					<dd>{f.day(s.startsAt, true)}</dd>
				</div>
				<div>
					<dt><Icon name="clock" size={17} /><span class="sr-only">Time</span></dt>
					<dd>
						{f.range(s.startsAt, s.endsAt)}
						<span class="subtle">({f.hours((s.endsAt - s.startsAt) / 3_600_000)})</span>
					</dd>
				</div>
				{#if s.location}
					<div>
						<dt><Icon name="pin" size={17} /><span class="sr-only">Location</span></dt>
						<dd>{s.location}</dd>
					</div>
				{/if}
				{#if s.notes}
					<div>
						<dt><Icon name="info" size={17} /><span class="sr-only">Notes</span></dt>
						<dd>{s.notes}</dd>
					</div>
				{/if}
			</dl>
			<FillMeter filled={s.filled} capacity={s.capacity} />
		</div>

		<div class="card-footer form-area">
			{#if data.already}
				<div class="alert alert-success">
					<Icon name="check-circle" size={20} />
					<div>
						<p class="strong">You’re already signed up for this shift.</p>
						<p><a href="/my">Manage your shifts</a></p>
					</div>
				</div>
			{:else if s.started}
				<div class="alert">
					<Icon name="clock" size={20} />
					<p>This shift has already started.</p>
				</div>
			{:else if full && !form?.values}
				<div class="alert alert-warn">
					<Icon name="alert" size={20} />
					<p>
						This shift is full. <a href="/events/{s.eventSlug}">Pick another time</a>, or check back
						later in case a spot opens.
					</p>
				</div>
			{:else}
				<form
					method="POST"
					class="stack"
					style="--gap: 18px"
					use:enhance={pending((v) => (busy = v))}
				>
					{#if form?.error}
						<div class="alert alert-error" role="alert">
							<Icon name="alert" size={20} />
							<p>
								{form.error}
								{#if form.code === 'full'}<a href="/events/{s.eventSlug}">See other shifts</a>{/if}
								{#if form.code === 'duplicate'}<a href="/my">Go to my shifts</a>{/if}
							</p>
						</div>
					{/if}

					<PersonFields
						values={form?.values}
						errors={form?.errors}
						me={data.me}
						smsAvailable={data.smsAvailable}
					/>

					<div class="form-actions">
						<button class="btn btn-primary btn-lg" disabled={busy}>
							<Icon name="check" size={18} />
							{busy ? 'Signing you up…' : 'Confirm sign-up'}
						</button>
					</div>
					<p class="hint">
						You’ll get a confirmation email{data.reminderHours.length
							? ' and a reminder before your shift'
							: ''}.
						{#if data.cancelCutoffHours > 0}
							You can switch or cancel up to {data.cancelCutoffHours} hours before, or ask someone to
							cover anytime.
						{:else}
							You can switch, cancel or ask someone to cover anytime.
						{/if}
					</p>
				</form>
			{/if}
		</div>
	</div>
</div>

<style>
	.facts {
		margin: 0;
		display: grid;
		gap: 10px;
	}
	.facts div {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}
	.facts dt {
		color: var(--accent-text);
		padding-top: 2px;
	}
	.facts dd {
		margin: 0;
		font-weight: 550;
	}
	.form-area {
		background: var(--surface);
		padding: 24px;
	}
	@media (max-width: 640px) {
		.form-area {
			padding: 20px;
		}
	}
</style>
