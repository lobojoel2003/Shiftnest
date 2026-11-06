<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import LogoMark from '#lib/components/LogoMark.svelte';
	import { REPO_URL, VERSION_LABEL } from '#lib/version.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const current = (href: string) =>
		href === '/'
			? page.url.pathname === '/' || page.url.pathname.startsWith('/events')
			: page.url.pathname.startsWith(href);
</script>

<header class="site-header">
	<div class="container row between nowrap">
		<a href="/" class="brand">
			<LogoMark size={34} />
			<span class="truncate">{data.org.name}</span>
		</a>
		<nav aria-label="Main" class="row nowrap main-nav" style="--gap: 4px">
			<a href="/" class="nav-link" aria-current={current('/') ? 'page' : undefined}>
				<Icon name="calendar" size={17} /><span class="hide-sm">Shifts</span>
			</a>
			<a href="/my" class="nav-link" aria-current={current('/my') ? 'page' : undefined}>
				<Icon name="user" size={17} />
				<span>{data.volunteer ? 'My shifts' : 'Find my shifts'}</span>
			</a>
			{#if data.user}
				<a href="/admin" class="nav-link"
					><Icon name="dashboard" size={17} /><span class="hide-sm">Admin</span></a
				>
			{/if}
		</nav>
	</div>
</header>

<main id="main">
	{@render children()}
</main>

<footer class="site-footer">
	<div class="container row between">
		<p class="subtle small">
			{data.org.name}
			{#if data.org.contactEmail}
				<span class="divider-dot"></span><a href="mailto:{data.org.contactEmail}"
					>{data.org.contactEmail}</a
				>
			{/if}
		</p>
		<p class="subtle small row" style="--gap: 0">
			<a href={REPO_URL} class="subtle" title={VERSION_LABEL}>Powered by Shiftnest</a>
			<span class="divider-dot"></span>
			<a href={data.user ? '/admin' : '/login'} class="subtle">Coordinators</a>
		</p>
	</div>
</footer>

<style>
	.site-header {
		position: sticky;
		top: 0;
		z-index: 30;
		height: var(--header-h);
		display: flex;
		align-items: center;
		background: color-mix(in srgb, var(--bg) 82%, transparent);
		backdrop-filter: saturate(1.4) blur(10px);
		-webkit-backdrop-filter: saturate(1.4) blur(10px);
		border-bottom: 1px solid var(--border);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 750;
		font-size: 1.02rem;
		letter-spacing: -0.01em;
		color: var(--text);
		text-decoration: none;
		min-width: 0;
	}
	.main-nav {
		flex: none;
	}
	.nav-link {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 8px 12px;
		border-radius: 999px;
		color: var(--text-2);
		font-weight: 600;
		font-size: 0.92rem;
		text-decoration: none;
		white-space: nowrap;
	}
	.nav-link:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.nav-link[aria-current='page'] {
		background: var(--accent-soft);
		color: var(--accent-text);
	}
	main {
		min-height: calc(100vh - var(--header-h) - 80px);
	}
	.site-footer {
		border-top: 1px solid var(--border);
		padding: 22px 0 28px;
	}
	.site-footer a {
		text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
	}
	.site-footer a:hover {
		text-decoration-color: currentColor;
	}
	@media (max-width: 560px) {
		.hide-sm {
			display: none;
		}
	}
</style>
