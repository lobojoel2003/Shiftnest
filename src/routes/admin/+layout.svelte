<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import type { IconName } from '#lib/components/icons.ts';
	import LogoMark from '#lib/components/LogoMark.svelte';
	import { initials } from '#lib/format.ts';
	import { REPO_URL, VERSION_LABEL } from '#lib/version.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
	let menuOpen = $state(false);

	afterNavigate(() => (menuOpen = false));

	const nav: { href: string; label: string; icon: IconName; badge?: () => number }[] = [
		{ href: '/admin', label: 'Dashboard', icon: 'dashboard', badge: () => data.badges.cover },
		{ href: '/admin/events', label: 'Events & shifts', icon: 'calendar' },
		{ href: '/admin/volunteers', label: 'Volunteers', icon: 'users' },
		{ href: '/admin/hours', label: 'Hours', icon: 'chart' },
		{
			href: '/admin/messages',
			label: 'Messages',
			icon: 'inbox',
			badge: () => data.badges.failedMessages
		},
		{ href: '/admin/team', label: 'Team', icon: 'user' },
		{ href: '/admin/settings', label: 'Settings', icon: 'settings' }
	];

	const isCurrent = (href: string) =>
		href === '/admin' ? page.url.pathname === '/admin' : page.url.pathname.startsWith(href);
</script>

<div class="shell">
	<header class="topbar no-print">
		<a href="/admin" class="brand"
			><LogoMark size={30} /><span class="truncate">{data.org.name}</span></a
		>
		<button
			class="btn btn-ghost btn-icon"
			aria-expanded={menuOpen}
			aria-controls="admin-nav"
			onclick={() => (menuOpen = !menuOpen)}
		>
			<Icon
				name={menuOpen ? 'x' : 'menu'}
				size={22}
				label={menuOpen ? 'Close menu' : 'Open menu'}
			/>
		</button>
	</header>

	<aside class="sidebar no-print" class:open={menuOpen} id="admin-nav">
		<a href="/admin" class="brand desktop-only"
			><LogoMark size={32} /><span class="truncate">{data.org.name}</span></a
		>
		<nav aria-label="Admin">
			<ul class="list-plain">
				{#each nav as item (item.href)}
					{@const count = item.badge?.() ?? 0}
					<li>
						<a href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}>
							<Icon name={item.icon} size={18} />
							<span class="grow">{item.label}</span>
							{#if count > 0}<span
									class="count"
									title={item.href === '/admin' ? 'Open cover requests' : 'Failed messages'}
									>{count}</span
								>{/if}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
		<div class="sidebar-foot">
			<a href="/" class="side-link" target="_blank" rel="noopener"
				><Icon name="external" size={16} /> View sign-up site</a
			>
			<div class="me">
				<span class="avatar">{initials(data.user.name)}</span>
				<div class="grow" style="min-width: 0">
					<a href="/admin/account" class="strong truncate me-name">{data.user.name}</a>
					<span class="subtle tiny-text"
						>{data.user.role === 'owner' ? 'Owner' : 'Coordinator'}</span
					>
				</div>
				<form method="POST" action="/logout">
					<button class="btn btn-ghost btn-icon" title="Sign out"
						><Icon name="logout" size={18} label="Sign out" /></button
					>
				</form>
			</div>
			<a class="version subtle tiny-text" href="{REPO_URL}/releases" target="_blank" rel="noopener"
				>Shiftnest {VERSION_LABEL}</a
			>
		</div>
	</aside>

	<main id="main" class="content">
		{#if !data.integrations.email && !page.url.pathname.startsWith('/admin/settings')}
			<div class="setup-banner no-print">
				<Icon name="info" size={16} />
				<span
					>Email isn’t set up yet, so messages are saved to <a href="/admin/messages">Messages</a>
					instead of being sent. <a href="/admin/settings#integrations">How to fix</a></span
				>
			</div>
		{/if}
		{@render children()}
	</main>
</div>

<style>
	.shell {
		min-height: 100vh;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 750;
		color: var(--text);
		text-decoration: none;
		min-width: 0;
	}
	.topbar {
		position: sticky;
		top: 0;
		z-index: 40;
		height: 58px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 12px 0 16px;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}
	.sidebar {
		display: none;
		flex-direction: column;
		gap: 20px;
		padding: 16px 12px;
		background: var(--surface);
		border-right: 1px solid var(--border);
	}
	.sidebar.open {
		display: flex;
		position: fixed;
		inset: 58px 0 0 0;
		z-index: 39;
		overflow-y: auto;
	}
	.desktop-only {
		display: none;
	}
	nav a {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 9px 12px;
		border-radius: 10px;
		color: var(--text-2);
		text-decoration: none;
		font-weight: 600;
		font-size: 0.93rem;
	}
	nav a:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	nav a[aria-current='page'] {
		background: var(--accent-soft);
		color: var(--accent-text);
	}
	nav li + li {
		margin-top: 2px;
	}
	.count {
		min-width: 22px;
		padding: 0 7px;
		border-radius: 999px;
		background: var(--amber-soft);
		color: var(--amber);
		font-size: 0.75rem;
		font-weight: 700;
		text-align: center;
		line-height: 1.7;
	}
	.sidebar-foot {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		border-top: 1px solid var(--border);
		padding-top: 14px;
	}
	.side-link {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 12px;
		color: var(--text-2);
		font-size: 0.88rem;
		font-weight: 600;
		text-decoration: none;
	}
	.me {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 4px 0 8px;
	}
	.me > div {
		display: flex;
		flex-direction: column;
		line-height: 1.3;
	}
	.me-name {
		color: var(--text);
		text-decoration: none;
		font-size: 0.9rem;
	}
	.version {
		padding: 0 12px;
		text-decoration: none;
	}
	.content {
		padding: 24px 16px 64px;
		max-width: 1200px;
	}
	.setup-banner {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		padding: 10px 14px;
		margin-bottom: 20px;
		border-radius: var(--radius);
		background: var(--blue-soft);
		font-size: 0.86rem;
	}
	.setup-banner :global(svg) {
		margin-top: 3px;
		flex: none;
		color: var(--blue);
	}
	@media (min-width: 960px) {
		.shell {
			display: grid;
			grid-template-columns: 248px minmax(0, 1fr);
			background: linear-gradient(
				90deg,
				var(--surface) 0 247px,
				var(--border) 247px 248px,
				transparent 248px
			);
		}
		.topbar {
			display: none;
		}
		.sidebar {
			display: flex;
			position: sticky;
			top: 0;
			height: 100vh;
			overflow-y: auto;
			border-right: 0;
			background: transparent;
		}
		.desktop-only {
			display: flex;
			padding: 4px 8px 8px;
		}
		.content {
			padding: 32px 40px 80px;
		}
	}
	@media print {
		.shell {
			display: block;
			background: none;
		}
		.content {
			padding: 0;
		}
	}
</style>
