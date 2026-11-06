<script lang="ts">
	let { month, day, weekday }: { month: string; day: string; weekday: string } = $props();
</script>

<div class="date-badge" aria-hidden="true">
	<span class="m">{month}</span>
	<span class="d">{day}</span>
	<span class="w">{weekday}</span>
</div>

<style>
	.date-badge {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 56px;
		min-width: 56px;
		padding: 6px 0 7px;
		border-radius: 12px;
		background: var(--accent-soft);
		color: var(--accent-text);
		line-height: 1.05;
	}
	.m,
	.w {
		font-size: 0.68rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.d {
		font-size: 1.45rem;
		font-weight: 750;
		letter-spacing: -0.02em;
		margin: 1px 0;
	}
</style>
