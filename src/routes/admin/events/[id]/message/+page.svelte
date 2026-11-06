<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Icon from '#lib/components/Icon.svelte';
	import { confirmFirst } from '#lib/enhance.ts';
	import { formatter } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const f = $derived(formatter(data.org));
</script>

<svelte:head>
	<title>Message volunteers · {data.event.title}</title>
</svelte:head>

<a href="/admin/events/{data.event.id}" class="back-link"
	><Icon name="arrow-left" size={16} /> {data.event.title}</a
>
<header class="page-header">
	<div>
		<h1>Message volunteers</h1>
		<p>Send an email to everyone signed up. Replies go to your contact email.</p>
	</div>
</header>

<form
	method="POST"
	class="card"
	style="max-width: 760px"
	use:enhance={confirmFirst(`Send this email to ${data.recipients.length} volunteer(s)?`)}
>
	<div class="card-body stack">
		<div class="field">
			<label for="shift">Who should get it?</label>
			<select
				id="shift"
				name="shiftId"
				value={data.shiftId ?? ''}
				onchange={(e) =>
					goto(e.currentTarget.value ? `?shift=${e.currentTarget.value}` : '?', {
						replaceState: true
					})}
			>
				<option value="">Everyone with an upcoming shift in this event</option>
				{#each data.shifts as s (s.id)}
					<option value={s.id}
						>{f.date(s.startsAt)} · {f.range(s.startsAt, s.endsAt)} · {s.role} ({s.filled})</option
					>
				{/each}
			</select>
			<p class="hint">
				{#if data.recipients.length}
					{data.recipients.length} recipient{data.recipients.length === 1 ? '' : 's'}: {data.recipients
						.slice(0, 8)
						.join(', ')}{data.recipients.length > 8
						? `, and ${data.recipients.length - 8} more`
						: ''}
				{:else}
					No one is signed up yet.
				{/if}
			</p>
		</div>
		<div class="field">
			<label for="subject">Subject</label>
			<input
				id="subject"
				name="subject"
				type="text"
				required
				maxlength="150"
				value={form?.subject ?? ''}
				placeholder="e.g. Parking update for Saturday"
			/>
			{#if form?.errors?.subject}<p class="error-text">{form.errors.subject}</p>{/if}
		</div>
		<div class="field">
			<label for="body">Message</label>
			<textarea id="body" name="body" rows="8" required maxlength="5000"
				>{form?.body ?? ''}</textarea
			>
			{#if form?.errors?.body}<p class="error-text">{form.errors.body}</p>{:else}<p class="hint">
					Each volunteer gets their own email with a link to their shifts. Leave a blank line
					between paragraphs.
				</p>{/if}
		</div>
	</div>
	<div class="card-footer form-actions">
		<button class="btn btn-primary" disabled={!data.recipients.length}
			><Icon name="send" size={16} /> Send email</button
		>
	</div>
</form>
