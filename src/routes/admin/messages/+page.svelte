<script lang="ts">
	import Icon from '#lib/components/Icon.svelte';
	import { formatter } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const f = $derived(formatter(data.org));
	const tabs = [
		['all', 'All'],
		['sent', 'Sent'],
		['logged', 'Not sent (no provider)'],
		['pending', 'Queued'],
		['failed', 'Failed']
	] as const;
	const badge: Record<string, string> = {
		sent: 'badge-green',
		logged: 'badge-blue',
		pending: 'badge-amber',
		failed: 'badge-red'
	};
	const label: Record<string, string> = {
		sent: 'Sent',
		logged: 'Logged',
		pending: 'Queued',
		failed: 'Failed'
	};
	const total = $derived(Object.values(data.counts).reduce((a, b) => a + b, 0));
</script>

<svelte:head>
	<title>Messages · {data.org.name}</title>
</svelte:head>

<header class="page-header">
	<div>
		<h1>Messages</h1>
		<p>
			Every email and text Shiftnest sends: confirmations, reminders, swaps and your announcements.
		</p>
	</div>
</header>

<div class="providers">
	<div class="card provider">
		<Icon name="mail" size={20} />
		<div class="grow">
			<p class="strong">Email</p>
			<p class="small muted">
				{data.email
					? `Sending through ${data.email}`
					: 'Not configured: emails are saved here only'}
			</p>
		</div>
		<span class="badge {data.email ? 'badge-green' : 'badge-amber'}"
			>{data.email ? 'On' : 'Off'}</span
		>
	</div>
	<div class="card provider">
		<Icon name="phone" size={20} />
		<div class="grow">
			<p class="strong">Text messages</p>
			<p class="small muted">
				{data.sms ? 'Sending through Twilio' : 'Optional: add Twilio to send text reminders'}
			</p>
		</div>
		<span class="badge {data.sms ? 'badge-green' : ''}">{data.sms ? 'On' : 'Off'}</span>
	</div>
</div>

<nav class="tabs" aria-label="Filter messages">
	{#each tabs as [key, text] (key)}
		<a href="?status={key}" aria-current={data.status === key ? 'page' : undefined}>
			{text} <span class="subtle">{key === 'all' ? total : data.counts[key]}</span>
		</a>
	{/each}
</nav>

{#if data.messages.length === 0}
	<div class="card empty">
		<h3>No messages</h3>
		<p>Messages will show up here as volunteers sign up.</p>
	</div>
{:else}
	<div class="card table-wrap">
		<table class="table">
			<thead><tr><th>When</th><th>To</th><th>Message</th><th>Status</th></tr></thead>
			<tbody>
				{#each data.messages as m (m.id)}
					<tr>
						<td class="nowrap small">{f.dateTime(m.createdAt)}</td>
						<td class="small"
							><span class="icon-text"
								><Icon name={m.channel === 'sms' ? 'phone' : 'mail'} size={14} />{m.recipient}</span
							></td
						>
						<td>
							<a href="/admin/messages/{m.id}" class="truncate msg">{m.subject}</a>
							<span class="subtle tiny-text">{m.kind.replace('_', ' ')}</span>
						</td>
						<td>
							<span class="badge {badge[m.status]}">{label[m.status]}</span>
							{#if m.error}<p
									class="tiny-text error-text truncate"
									title={m.error}
									style="max-width: 220px"
								>
									{m.error}
								</p>{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if data.pages > 1}
		<nav class="row" style="justify-content: center; margin-top: 16px" aria-label="Pages">
			{#if data.page > 1}<a class="btn btn-sm" href="?status={data.status}&page={data.page - 1}"
					>Previous</a
				>{/if}
			<span class="small muted">Page {data.page} of {data.pages}</span>
			{#if data.page < data.pages}<a
					class="btn btn-sm"
					href="?status={data.status}&page={data.page + 1}">Next</a
				>{/if}
		</nav>
	{/if}
{/if}

<style>
	.providers {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 12px;
		margin-bottom: 24px;
	}
	.provider {
		display: flex;
		gap: 14px;
		align-items: center;
		padding: 16px 18px;
	}
	.provider > :global(svg) {
		color: var(--accent-text);
	}
	.msg {
		display: block;
		max-width: 420px;
		color: var(--text);
		font-weight: 550;
		text-decoration: none;
	}
	.msg:hover {
		text-decoration: underline;
	}
</style>
