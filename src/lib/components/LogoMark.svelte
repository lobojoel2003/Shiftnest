<script lang="ts">
	/** The Shiftnest mark: a nest holding three eggs, one per filled spot. */
	let { size = 32 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
	<rect width="64" height="64" rx="16" fill="#0f766e" />
	<ellipse cx="22.5" cy="29" rx="7" ry="8.6" fill="#fcd34d" />
	<ellipse cx="41.5" cy="29" rx="7" ry="8.6" fill="#fbbf24" />
	<ellipse cx="32" cy="25.5" rx="7.4" ry="9" fill="#fef3c7" />
	<path d="M9.5 33.5h45c0 10.8-10 18.5-22.5 18.5S9.5 44.3 9.5 33.5z" fill="#f0fdfa" />
	<path
		d="M14.5 39.5c6.5 2.6 28.5 2.6 35 0M19.5 45.5c5 1.8 20 1.8 25 0"
		fill="none"
		stroke="#5eead4"
		stroke-width="2.6"
		stroke-linecap="round"
	/>
</svg>
