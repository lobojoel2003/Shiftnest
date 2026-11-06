<script lang="ts">
	import { icons, type IconName } from './icons.ts';

	let {
		name,
		size = 18,
		label,
		class: className = ''
	}: { name: IconName; size?: number; label?: string; class?: string } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	aria-hidden={label ? undefined : 'true'}
	role={label ? 'img' : undefined}
	aria-label={label}
	focusable="false"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- static, trusted icon markup -->
	{@html icons[name]}
</svg>

<style>
	svg {
		flex: none;
	}
</style>
