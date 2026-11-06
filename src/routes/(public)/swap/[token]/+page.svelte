<script lang="ts">
	import { enhance } from '$app/forms';
	import CopyField from '#lib/components/CopyField.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PersonFields from '#lib/components/PersonFields.svelte';
	import { pending } from '#lib/enhance.ts';
	import { formatter } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const f = $derived(formatter(data.org));
	let busy = $state(false);
</script>

<svelte:head>
	<title>Cover a shift · {data.org.name}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="container narrow page">
	{#if !data.available}
		<div class="card card-body empty">
			<Icon name="check-circle" size={36} class="ok-icon" />
			<h3>This shift is covered</h3>
			<p>Someone already took it, or the request was withdrawn. Thanks for checking!</p>
			<p style="margin-top: 16px"><a class="btn btn-primary" href="/">See other shifts</a></p>
		</div>
	{:else}
		{@const s = data.shift}
		<div class="card">
			<div class="card-body stack" style="--gap: 16px">
				<div class="stack" style="--gap: 6px">
					<p class="eyebrow"><Icon name="swap" size={14} class="inline-icon" /> Cover request</p>
					<h1>{data.own ? 'Your shift needs cover' : `Can you cover for ${data.requester}?`}</h1>
					<p class="muted">
						{data.own
							? 'You’re still on this shift until someone takes it. Share this page with anyone who might help.'
							: `${data.requester} can’t make this shift anymore. If you take it, you’ll be signed up in their place.`}
					</p>
				</div>
				<dl class="facts">
					<div>
						<dt><Icon name="users" size={17} /><span class="sr-only">Shift</span></dt>
						<dd>{s.role} · {s.eventTitle}</dd>
					</div>
					<div>
						<dt><Icon name="calendar" size={17} /><span class="sr-only">Date</span></dt>
						<dd>{f.day(s.startsAt, true)}</dd>
					</div>
					<div>
						<dt><Icon name="clock" size={17} /><span class="sr-only">Time</span></dt>
						<dd>{f.range(s.startsAt, s.endsAt)}</dd>
					</div>
					{#if s.location}<div>
							<dt><Icon name="pin" size={17} /><span class="sr-only">Location</span></dt>
							<dd>{s.location}</dd>
						</div>{/if}
					{#if s.notes}<div>
							<dt><Icon name="info" size={17} /><span class="sr-only">Notes</span></dt>
							<dd>{s.notes}</dd>
						</div>{/if}
				</dl>
			</div>
			<div class="card-footer" style="background: var(--surface); padding: 24px">
				{#if data.own}
					<div class="stack" style="--gap: 10px">
						<CopyField value={data.shareUrl} label="Cover link" />
						<p class="hint">
							Changed your mind? <a href="/my">Withdraw the request</a> from My shifts.
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
								<p>{form.error}</p>
							</div>
						{/if}
						<PersonFields
							values={form?.values}
							errors={form?.errors}
							me={data.me}
							smsAvailable={data.smsAvailable}
							showNote={false}
						/>
						<div class="form-actions">
							<button class="btn btn-primary btn-lg" disabled={busy}>
								<Icon name="check" size={18} />{busy ? 'Taking shift…' : 'Take this shift'}
							</button>
							<a class="btn btn-ghost" href="/events/{s.eventSlug}">See other shifts</a>
						</div>
					</form>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	h1 {
		font-size: 1.6rem;
	}
	.eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.facts {
		margin: 0;
		display: grid;
		gap: 10px;
	}
	.facts div {
		display: flex;
		gap: 12px;
	}
	.facts dt {
		color: var(--accent-text);
		padding-top: 2px;
	}
	.facts dd {
		margin: 0;
		font-weight: 550;
	}
	.empty :global(.ok-icon) {
		margin: 0 auto 12px;
		color: var(--green);
	}
</style>
