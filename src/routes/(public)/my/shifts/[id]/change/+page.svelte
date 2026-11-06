<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import { pending } from '#lib/enhance.ts';
	import { formatter } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const f = $derived(formatter(data.org));
	let busy = $state(false);
	let selected = $state<number | null>(null);
	const available = $derived(data.options.filter((o) => o.open > 0));
</script>

<svelte:head>
	<title>Switch shift · {data.org.name}</title>
</svelte:head>

<div class="container narrow page">
	<a href="/my" class="back-link"><Icon name="arrow-left" size={16} /> My shifts</a>

	<div class="card">
		<div class="card-body stack" style="--gap: 8px">
			<p class="eyebrow">Switch to another time</p>
			<h1 style="font-size: 1.5rem">{data.current.role}</h1>
			<p class="muted">
				Currently: {f.when(data.current.startsAt, data.current.endsAt)} · {data.current.eventTitle}
			</p>
		</div>

		<div class="card-footer" style="background: var(--surface)">
			{#if data.locked}
				<div class="alert alert-warn">
					<Icon name="alert" size={20} />
					<p>
						It’s less than {data.cutoffHours} hours until this shift, so it can’t be switched online.
						Go back and choose <strong>Find cover</strong> instead.
					</p>
				</div>
			{:else if available.length === 0}
				<div class="empty">
					<h3>No other times have open spots</h3>
					<p>
						You can keep your shift, or ask someone to cover it from <a href="/my">My shifts</a>.
					</p>
				</div>
			{:else}
				<form method="POST" class="stack" use:enhance={pending((v) => (busy = v))}>
					{#if form?.error}
						<div class="alert alert-error" role="alert">
							<Icon name="alert" size={20} />
							<p>{form.error}</p>
						</div>
					{/if}
					<fieldset>
						<legend>Pick a new shift</legend>
						<div class="options">
							{#each available as o (o.id)}
								<label class="option" class:selected={selected === o.id}>
									<input type="radio" name="shiftId" value={o.id} bind:group={selected} required />
									<span class="grow">
										<span class="strong"
											>{f.date(o.startsAt)} · {f.range(o.startsAt, o.endsAt)}</span
										>
										<span class="small muted">{o.role}{o.sameRole ? '' : ' (different role)'}</span>
									</span>
									<span class="badge badge-accent">{o.open} open</span>
								</label>
							{/each}
						</div>
					</fieldset>
					<div class="form-actions">
						<button class="btn btn-primary" disabled={busy || selected === null}>
							<Icon name="swap" size={16} />{busy ? 'Switching…' : 'Switch my shift'}
						</button>
						<a class="btn btn-ghost" href="/my">Keep current shift</a>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>

<style>
	.options {
		display: grid;
		gap: 8px;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		cursor: pointer;
	}
	.option > span.grow {
		display: flex;
		flex-direction: column;
	}
	.option.selected {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.option input {
		accent-color: var(--accent);
		width: 18px;
		height: 18px;
	}
</style>
