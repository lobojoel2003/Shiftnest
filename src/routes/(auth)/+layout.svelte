<script lang="ts">
	import LogoMark from '#lib/components/LogoMark.svelte';
	import { VERSION_LABEL } from '#lib/version.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<main id="main" class="auth">
	<a href="/" class="brand">
		<LogoMark size={40} />
		<span>{data.org.name}</span>
	</a>
	<div class="card auth-card">
		{@render children()}
	</div>
	<p class="subtle tiny-text">Shiftnest {VERSION_LABEL}</p>
</main>

<style>
	.auth {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 20px;
		padding: 32px 16px;
		background:
			radial-gradient(900px 400px at 50% -10%, var(--accent-soft), transparent 70%), var(--bg);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		font-weight: 750;
		font-size: 1.1rem;
		color: var(--text);
		text-decoration: none;
	}
	.auth-card {
		width: 100%;
		max-width: 440px;
		padding: 28px;
		box-shadow: var(--shadow-lg);
	}
	@media (max-width: 480px) {
		.auth-card {
			padding: 22px;
		}
	}
</style>
