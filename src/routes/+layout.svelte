<script lang="ts">
	import '../app.css';
	import FlashToast from '#lib/components/FlashToast.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<a class="skip-link" href="#main">Skip to content</a>

{@render children()}

<FlashToast flash={data.flash} />
