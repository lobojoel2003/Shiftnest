<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import { formatter } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const f = $derived(formatter(data.org));
	const m = $derived(data.message);
</script>

<svelte:head>
	<title>{m.subject || 'Text message'} · Messages</title>
</svelte:head>

<a href="/admin/messages" class="back-link"><Icon name="arrow-left" size={16} /> Messages</a>

<article class="card" style="max-width: 760px">
	<header class="card-body stack" style="--gap: 8px; border-bottom: 1px solid var(--border)">
		<h1 style="font-size: 1.3rem">{m.subject || 'Text message'}</h1>
		<dl class="meta small">
			<dt>To</dt>
			<dd>{m.recipient}</dd>
			<dt>Type</dt>
			<dd>{m.channel === 'sms' ? 'Text' : 'Email'} · {m.kind.replace('_', ' ')}</dd>
			<dt>Created</dt>
			<dd>{f.dateTime(m.createdAt)}</dd>
			<dt>Status</dt>
			<dd>
				{m.status === 'logged' ? 'Logged (no provider configured)' : m.status}
				{#if m.sentAt}
					· {f.dateTime(m.sentAt)}{/if}
				{#if m.attempts > 1}
					· {m.attempts} attempts{/if}
			</dd>
			{#if m.error}<dt>Error</dt>
				<dd class="error-text">{m.error}</dd>{/if}
		</dl>
		{#if m.status === 'failed'}
			<form method="POST" action="?/retry" use:enhance>
				<button class="btn btn-sm btn-primary"><Icon name="refresh" size={15} /> Try again</button>
			</form>
		{/if}
	</header>
	<pre class="body">{m.body}</pre>
</article>

<style>
	.meta {
		display: grid;
		grid-template-columns: 80px 1fr;
		gap: 4px 12px;
		margin: 0;
	}
	.meta dt {
		color: var(--text-3);
	}
	.meta dd {
		margin: 0;
	}
	.body {
		margin: 0;
		padding: 24px;
		white-space: pre-wrap;
		word-break: break-word;
		font-family: var(--font-sans);
		font-size: 0.92rem;
		line-height: 1.6;
	}
</style>
