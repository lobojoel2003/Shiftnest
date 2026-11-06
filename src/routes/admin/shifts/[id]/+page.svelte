<script lang="ts">
	import { enhance } from '$app/forms';
	import FillMeter from '#lib/components/FillMeter.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import ShiftFields from '#lib/components/ShiftFields.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import { confirmFirst } from '#lib/enhance.ts';
	import { formatter, initials } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const f = $derived(formatter(data.org));
	const s = $derived(data.shift);
	const reasons: Record<string, string> = {
		volunteer: 'Cancelled',
		coordinator: 'Removed by coordinator',
		moved: 'Switched to another shift',
		swapped: 'Covered by someone else',
		shift_deleted: 'Shift deleted'
	};
</script>

<svelte:head>
	<title>{s.role} · {f.date(s.startsAt)} · {data.org.name}</title>
</svelte:head>

<a href="/admin/events/{s.eventId}" class="back-link"
	><Icon name="arrow-left" size={16} /> {s.eventTitle}</a
>

<header class="page-header">
	<div>
		<h1>{s.role}</h1>
		<p class="row" style="--gap: 4px 16px">
			<span class="icon-text"><Icon name="calendar" size={16} />{f.day(s.startsAt, true)}</span>
			<span class="icon-text"><Icon name="clock" size={16} />{f.range(s.startsAt, s.endsAt)}</span>
			{#if s.location || s.eventLocation}<span class="icon-text"
					><Icon name="pin" size={16} />{s.location || s.eventLocation}</span
				>{/if}
		</p>
	</div>
	<div class="row" style="--gap: 8px">
		<a class="btn btn-sm" href="/admin/events/{s.eventId}/message?shift={s.id}"
			><Icon name="mail" size={15} /> Email this shift</a
		>
		<a class="btn btn-sm" href="/events/{s.eventSlug}#shift-{s.id}" target="_blank" rel="noopener"
			><Icon name="eye" size={15} /> Public view</a
		>
	</div>
</header>

<div class="layout">
	<div class="stack" style="--gap: 20px">
		<section class="card" aria-labelledby="roster-heading">
			<div class="card-header">
				<h2 id="roster-heading">Roster</h2>
				<div class="row" style="--gap: 14px">
					<div style="width: 170px"><FillMeter filled={s.filled} capacity={s.capacity} /></div>
					{#if s.started && data.roster.some((p) => p.status === 'confirmed')}
						<form method="POST" action="?/markAllAttended" use:enhance>
							<button class="btn btn-sm btn-soft"
								><Icon name="check" size={15} /> Mark all attended</button
							>
						</form>
					{/if}
				</div>
			</div>
			{#if form?.error}
				<div class="alert alert-error" style="margin: 16px 20px 0">
					<Icon name="alert" size={18} />
					<p>{form.error}</p>
				</div>
			{/if}
			{#if data.roster.length === 0}
				<div class="empty">
					<h3>No one yet</h3>
					<p>Share the sign-up page, or add someone on the right.</p>
				</div>
			{:else}
				<ul class="list-plain roster">
					{#each data.roster as p (p.id)}
						<li class="person">
							<span class="avatar">{initials(p.name)}</span>
							<div class="who grow">
								<div class="row" style="--gap: 8px">
									<a href="/admin/volunteers/{p.volunteerId}" class="strong">{p.name}</a>
									{#if p.status !== 'confirmed' && !s.started}<StatusBadge status={p.status} />{/if}
									{#if p.needsCover}<a
											href={p.coverUrl}
											class="badge badge-amber"
											target="_blank"
											rel="noopener">Needs cover</a
										>{/if}
									{#if p.checkedInAt}<span class="badge badge-blue"
											>Checked in {f.time(p.checkedInAt)}</span
										>{/if}
								</div>
								<p class="small muted row" style="--gap: 2px 12px">
									<a href="mailto:{p.email}">{p.email}</a>
									{#if p.phone}<a href="tel:{p.phone}">{p.phone}</a>{/if}
								</p>
								{#if p.note}<p class="small note">“{p.note}”</p>{/if}
							</div>
							<div class="controls">
								{#if s.started}
									<form
										method="POST"
										action="?/attendance"
										use:enhance
										class="seg"
										aria-label="Attendance for {p.name}"
									>
										<input type="hidden" name="signupId" value={p.id} />
										<input type="hidden" name="hours" value={p.hours ?? ''} />
										<button name="status" value="attended" aria-pressed={p.status === 'attended'}
											><Icon name="check" size={14} /> Attended</button
										>
										<button name="status" value="no_show" aria-pressed={p.status === 'no_show'}
											>No-show</button
										>
									</form>
									<form method="POST" action="?/attendance" use:enhance class="hours">
										<input type="hidden" name="signupId" value={p.id} />
										<input
											type="hidden"
											name="status"
											value={p.status === 'confirmed' ? 'attended' : p.status}
										/>
										<label class="sr-only" for="hours-{p.id}">Hours for {p.name}</label>
										<input
											id="hours-{p.id}"
											name="hours"
											type="number"
											step="0.25"
											min="0"
											max="24"
											placeholder={String(Math.round(s.defaultHours * 100) / 100)}
											value={p.hours ?? ''}
											title="Hours (leave blank to use the shift length)"
										/>
										<span class="subtle small">h</span>
										<button class="btn btn-sm btn-ghost"
											>{form?.saved === p.id ? 'Saved' : 'Save'}</button
										>
									</form>
								{:else}
									<span class="subtle small nowrap">Signed up {f.date(p.createdAt)}</span>
								{/if}
								<form
									method="POST"
									action="?/remove"
									use:enhance={confirmFirst(
										`Remove ${p.name} from this shift?${s.started ? '' : ' They’ll get an email.'}`
									)}
								>
									<input type="hidden" name="signupId" value={p.id} />
									<button class="btn btn-sm btn-ghost btn-icon" title="Remove {p.name}"
										><Icon name="x" size={16} label="Remove {p.name}" /></button
									>
								</form>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		{#if data.cancelled.length}
			<details class="card">
				<summary class="card-header"><h2>Changes ({data.cancelled.length})</h2></summary>
				<ul class="list-plain">
					{#each data.cancelled as c (c.id)}
						<li class="change small">
							<a href="/admin/volunteers/{c.volunteerId}">{c.name}</a>
							<span class="muted">{reasons[c.reason ?? 'volunteer'] ?? 'Cancelled'}</span>
							{#if c.at}<span class="subtle">· {f.dateTime(c.at)}</span>{/if}
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	</div>

	<aside class="stack" style="--gap: 20px">
		<section class="card" aria-labelledby="add-heading">
			<div class="card-header"><h2 id="add-heading">Add a volunteer</h2></div>
			<form method="POST" action="?/add" class="card-body stack" style="--gap: 12px" use:enhance>
				<div class="field">
					<label for="add-name">Name</label>
					<input
						id="add-name"
						name="name"
						type="text"
						required
						maxlength="100"
						value={form?.add?.name ?? ''}
					/>
					{#if form?.addErrors?.name}<p class="error-text">{form.addErrors.name}</p>{/if}
				</div>
				<div class="field">
					<label for="add-email">Email</label>
					<input id="add-email" name="email" type="email" required value={form?.add?.email ?? ''} />
					{#if form?.addErrors?.email}<p class="error-text">{form.addErrors.email}</p>{:else}<p
							class="hint"
						>
							Existing volunteers are matched by email.
						</p>{/if}
				</div>
				<div class="field">
					<label for="add-phone">Phone <span class="optional">(optional)</span></label>
					<input id="add-phone" name="phone" type="tel" value={form?.add?.phone ?? ''} />
					{#if form?.addErrors?.phone}<p class="error-text">{form.addErrors.phone}</p>{/if}
				</div>
				{#if !s.started}
					<label class="check small"
						><input type="checkbox" name="notify" checked /> Email them a confirmation</label
					>
				{/if}
				<button class="btn btn-primary btn-sm"><Icon name="plus" size={15} /> Add to shift</button>
				<p class="hint">Coordinators can add people even when a shift is full.</p>
			</form>
		</section>

		<details class="card" open={!!form?.edit}>
			<summary class="card-header"
				><h2>Edit shift</h2>
				<Icon name="chevron-down" size={16} /></summary
			>
			<form method="POST" action="?/update" use:enhance>
				<div class="card-body stack">
					<ShiftFields
						values={form?.edit?.values ?? data.values}
						errors={form?.edit?.errors}
						idPrefix="edit"
					/>
					{#if !s.started && data.roster.length}
						<label class="check small"
							><input type="checkbox" name="notify" checked /> Email volunteers if the time or place changes</label
						>
					{/if}
				</div>
				<div class="card-footer form-actions">
					<button class="btn btn-primary btn-sm">Save shift</button>
				</div>
			</form>
		</details>

		<form
			method="POST"
			action="?/delete"
			use:enhance={confirmFirst(
				`Delete this shift?${!s.started && data.roster.length ? ` ${data.roster.length} volunteer(s) will be emailed that it’s cancelled.` : ''}`
			)}
		>
			<button class="btn btn-sm btn-danger btn-block"
				><Icon name="trash" size={15} /> Delete shift</button
			>
		</form>
	</aside>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 24px;
	}
	@media (min-width: 1180px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 340px;
			align-items: start;
		}
	}
	.person {
		display: flex;
		gap: 14px;
		align-items: flex-start;
		padding: 16px 20px;
		flex-wrap: wrap;
	}
	.person + .person {
		border-top: 1px solid var(--border);
	}
	.who {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 200px;
	}
	.who a {
		text-decoration: none;
	}
	.who a.strong {
		color: var(--text);
	}
	.note {
		color: var(--text-2);
		font-style: italic;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.seg {
		display: inline-flex;
		border: 1px solid var(--border-strong);
		border-radius: 9px;
		overflow: hidden;
	}
	.seg button {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		border: 0;
		background: var(--surface);
		color: var(--text-2);
		padding: 6px 11px;
		font: inherit;
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
	}
	.seg button + button {
		border-left: 1px solid var(--border-strong);
	}
	.seg button[aria-pressed='true'][value='attended'] {
		background: var(--green-soft);
		color: var(--green);
	}
	.seg button[aria-pressed='true'][value='no_show'] {
		background: var(--red-soft);
		color: var(--red);
	}
	.hours {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.hours input {
		width: 74px;
		min-height: 32px;
		padding: 4px 8px;
		font-size: 0.85rem;
	}
	summary.card-header {
		cursor: pointer;
		list-style: none;
	}
	summary.card-header::-webkit-details-marker {
		display: none;
	}
	details:not([open]) summary.card-header {
		border-bottom: 0;
	}
	.change {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 10px 20px;
		border-top: 1px solid var(--border);
	}
</style>
