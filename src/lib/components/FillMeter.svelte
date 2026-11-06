<script lang="ts">
	let {
		filled,
		capacity,
		compact = false
	}: { filled: number; capacity: number; compact?: boolean } = $props();

	const pct = $derived(capacity > 0 ? Math.min(100, Math.round((filled / capacity) * 100)) : 0);
	const open = $derived(Math.max(0, capacity - filled));
	const state = $derived(filled >= capacity ? 'full' : pct < 40 ? 'low' : '');
</script>

<div class="fill" class:compact>
	<div
		class="meter {state}"
		role="meter"
		aria-valuemin={0}
		aria-valuemax={capacity}
		aria-valuenow={Math.min(filled, capacity)}
		aria-label="{filled} of {capacity} spots filled"
	>
		<span style:width="{pct}%"></span>
	</div>
	<span class="label tabular">
		{#if open === 0}
			<strong>Full</strong> · {filled}/{capacity}
		{:else}
			<strong>{open} open</strong> · {filled}/{capacity}
		{/if}
	</span>
</div>

<style>
	.fill {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 110px;
	}
	.label {
		font-size: 0.8rem;
		color: var(--text-3);
		white-space: nowrap;
	}
	.label strong {
		color: var(--text-2);
		font-weight: 650;
	}
	.compact {
		min-width: 90px;
	}
</style>
