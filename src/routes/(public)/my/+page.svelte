<script lang="ts">
	import { enhance } from '$app/forms';
	import CopyField from '#lib/components/CopyField.svelte';
	import DateBadge from '#lib/components/DateBadge.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import { confirmFirst, pending } from '#lib/enhance.ts';
	import { formatter } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const f = $derived(formatter(data.org));
	let busy = $state(false);
</script>

<svelte:head>
	<title>My shifts · {data.org.name}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

{#if !data.signedIn}
	<div class="container tiny page">
		<div class="card card-body stack" style="--gap: 18px">
			<div class="stack" style="--gap: 6px">
				<p class="eyebrow">Your shifts</p>
				<h1 style="font-size: 1.6rem">Find your shifts</h1>
				<p class="muted">
					No password needed. Enter the email you signed up with and we’ll send you a personal link
					to see, switch, or cancel your shifts.
				</p>
			</div>
			{#if form?.sent}
				<div class="alert alert-success" role="status">
					<Icon name="mail" size={20} />
					<div>
						<p class="strong">Check your inbox</p>
						<p>
							If {form.email} has signed up with us, a link is on its way. It can take a minute to arrive.
						</p>
					</div>
				</div>
			{:else}
				<form
					method="POST"
					action="?/sendLink"
					class="stack"
					use:enhance={pending((v) => (busy = v))}
				>
					<div class="field">
						<label for="email">Email address</label>
						<input
							id="email"
							name="email"
							type="email"
							autocomplete="email"
							inputmode="email"
							required
							value={form?.email ?? ''}
							aria-invalid={form?.error ? 'true' : undefined}
							aria-describedby={form?.error ? 'email-error' : undefined}
						/>
						{#if form?.error}<p class="error-text" id="email-error">{form.error}</p>{/if}
					</div>
					<button class="btn btn-primary btn-block" disabled={busy}>
						<Icon name="send" size={16} />{busy ? 'Sending…' : 'Email me my link'}
					</button>
				</form>
			{/if}
			<p class="hint">Haven’t signed up yet? <a href="/">Browse open shifts</a>.</p>
		</div>
	</div>
{:else}
	<div class="container page">
		<header class="page-header">
			<div>
				<p class="eyebrow">My shifts</p>
				<h1>Hi, {data.me.name.split(' ')[0]}!</h1>
				<p>Thanks for volunteering with {data.org.name}.</p>
			</div>
			<a class="btn btn-primary" href="/"><Icon name="plus" size={16} /> Sign up for more</a>
		</header>

		<div class="stats">
			<div class="card stat">
				<span class="stat-value tabular">{data.upcoming.length}</span>
				<span class="stat-label">Upcoming {data.upcoming.length === 1 ? 'shift' : 'shifts'}</span>
			</div>
			<div class="card stat">
				<span class="stat-value tabular">{data.totals.shifts}</span>
				<span class="stat-label">Shifts completed</span>
			</div>
			<div class="card stat">
				<span class="stat-value tabular">{Math.round(data.totals.hours * 10) / 10}</span>
				<span class="stat-label">Hours given</span>
			</div>
		</div>

		<div class="layout">
			<div class="stack" style="--gap: 28px">
				<section aria-labelledby="upcoming-heading">
					<div class="section-title"><h2 id="upcoming-heading">Coming up</h2></div>
					{#if data.upcoming.length === 0}
						<div class="card empty">
							<h3>Nothing scheduled</h3>
							<p><a href="/">Find a shift</a> that works for you.</p>
						</div>
					{:else}
						<ul class="list-plain stack" style="--gap: 12px">
							{#each data.upcoming as s (s.id)}
								<li class="card upcoming">
									<div class="card-body row nowrap" style="--gap: 16px; align-items: flex-start">
										<DateBadge {...f.badge(s.startsAt)} />
										<div class="grow stack" style="--gap: 4px">
											<div class="row" style="--gap: 8px">
												<h3>{s.role}</h3>
												{#if s.status === 'attended'}<StatusBadge status="attended" />{/if}
												{#if s.coverUrl}<StatusBadge status="cover" />{/if}
											</div>
											<p class="muted small">{s.eventTitle}</p>
											<p class="small row" style="--gap: 4px 14px">
												<span class="icon-text"
													><Icon name="clock" size={15} />{f.relative(s.startsAt, data.now)} · {f.range(
														s.startsAt,
														s.endsAt
													)}</span
												>
												{#if s.location}<span class="icon-text"
														><Icon name="pin" size={15} />{s.location}</span
													>{/if}
											</p>
											{#if s.notes}<p class="small subtle">{s.notes}</p>{/if}
										</div>
									</div>

									{#if s.coverUrl}
										<div class="cover-box">
											<p class="small">
												<strong>Looking for cover.</strong> You’re still on this shift until someone takes
												it. Send this link to a friend, or wait for someone to pick it up from the shift
												list:
											</p>
											<CopyField value={s.coverUrl} label="Cover link for {s.role}" />
										</div>
									{/if}

									<div class="card-footer actions">
										{#if s.canCheckIn}
											<form method="POST" action="?/checkin" use:enhance>
												<input type="hidden" name="signupId" value={s.id} />
												<button class="btn btn-sm btn-primary"
													><Icon name="check-circle" size={15} /> I’m here, check me in</button
												>
											</form>
										{/if}
										<a class="btn btn-sm" href="/ical/shifts/{s.shiftId}.ics" download
											><Icon name="download" size={15} /> Calendar</a
										>
										<a
											class="btn btn-sm btn-ghost"
											href={s.googleUrl}
											target="_blank"
											rel="noopener noreferrer"
											>Google Calendar <Icon name="external" size={13} /></a
										>
										<span class="grow"></span>
										{#if s.canChange}
											<a class="btn btn-sm" href="/my/shifts/{s.id}/change"
												><Icon name="swap" size={15} /> Switch time</a
											>
										{/if}
										{#if s.canCover && !s.coverUrl}
											<form method="POST" action="?/cover" use:enhance>
												<input type="hidden" name="signupId" value={s.id} />
												<button class="btn btn-sm"
													><Icon name="users" size={15} /> Find cover</button
												>
											</form>
										{/if}
										{#if s.coverUrl}
											<form method="POST" action="?/withdrawCover" use:enhance>
												<input type="hidden" name="signupId" value={s.id} />
												<button class="btn btn-sm btn-ghost">I can make it after all</button>
											</form>
										{/if}
										{#if s.canChange}
											<form
												method="POST"
												action="?/cancel"
												use:enhance={confirmFirst(`Cancel your ${s.role} shift?`)}
											>
												<input type="hidden" name="signupId" value={s.id} />
												<button class="btn btn-sm btn-danger"
													><Icon name="x" size={15} /> Cancel</button
												>
											</form>
										{:else if s.lockedByCutoff}
											<span
												class="small subtle"
												title="Shifts can’t be cancelled within {data.cancelCutoffHours} hours of the start"
											>
												Less than {data.cancelCutoffHours}h to go: use “Find cover”
											</span>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				{#if data.past.length}
					<section aria-labelledby="past-heading">
						<div class="section-title"><h2 id="past-heading">History</h2></div>
						<div class="card table-wrap">
							<table class="table">
								<thead>
									<tr><th>Date</th><th>Shift</th><th>Status</th><th class="num">Hours</th></tr>
								</thead>
								<tbody>
									{#each data.past as p (p.id)}
										<tr>
											<td class="nowrap">{f.date(p.startsAt, true)}</td>
											<td
												><span class="strong">{p.role}</span>
												<span class="subtle small">· {p.eventTitle}</span></td
											>
											<td>
												{#if p.status === 'confirmed'}<span class="badge">Completed</span
													>{:else}<StatusBadge status={p.status} />{/if}
											</td>
											<td class="num">{p.hours ? f.hours(p.hours) : '–'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</section>
				{/if}
			</div>

			<aside class="stack" style="--gap: 16px">
				<section class="card" aria-labelledby="cal-heading">
					<div class="card-body stack" style="--gap: 12px">
						<h2 id="cal-heading" class="icon-text" style="font-size: 1rem">
							<Icon name="calendar" size={18} /> Sync with your calendar
						</h2>
						<p class="small muted">
							Subscribe once and your shifts show up (and update) in Apple Calendar, Google
							Calendar, or Outlook.
						</p>
						<a class="btn btn-sm btn-soft" href={data.calendarUrl.replace(/^https?:/, 'webcal:')}
							><Icon name="feed" size={15} /> Subscribe</a
						>
						<CopyField value={data.calendarUrl} label="Calendar feed address" />
						<p class="hint">In Google Calendar: Other calendars → + → From URL, then paste.</p>
					</div>
				</section>

				<section class="card" aria-labelledby="profile-heading">
					<form
						method="POST"
						action="?/profile"
						class="card-body stack"
						style="--gap: 14px"
						use:enhance
					>
						<h2 id="profile-heading" style="font-size: 1rem">Your details</h2>
						<div class="field">
							<label for="p-name">Name</label>
							<input
								id="p-name"
								name="name"
								type="text"
								required
								maxlength="100"
								autocomplete="name"
								value={form?.profile?.name ?? data.me.name}
							/>
							{#if form?.errors?.name}<p class="error-text">{form.errors.name}</p>{/if}
						</div>
						<div class="field">
							<label for="p-email">Email</label>
							<input id="p-email" type="email" value={data.me.email} readonly />
						</div>
						<div class="field">
							<label for="p-phone">Mobile <span class="optional">(optional)</span></label>
							<input
								id="p-phone"
								name="phone"
								type="tel"
								autocomplete="tel"
								maxlength="40"
								value={form?.profile?.phone ?? data.me.phone}
							/>
							{#if form?.errors?.phone}<p class="error-text">{form.errors.phone}</p>{/if}
						</div>
						{#if data.smsAvailable}
							<label class="check small"
								><input type="checkbox" name="sms" checked={form?.profile?.sms ?? data.me.sms} /> Text
								me reminders</label
							>
						{/if}
						<button class="btn btn-sm">Save</button>
					</form>
				</section>

				<section class="card card-body stack" style="--gap: 10px">
					<h2 style="font-size: 1rem">Privacy</h2>
					<p class="small muted">
						Your personal link works like a key. If you forwarded it by accident, get a new one.
					</p>
					<div class="row" style="--gap: 8px">
						<form
							method="POST"
							action="?/resetLinks"
							use:enhance={confirmFirst(
								'Get new links? Your old email links and calendar feed will stop working.'
							)}
						>
							<button class="btn btn-sm"><Icon name="refresh" size={15} /> New links</button>
						</form>
						<form method="POST" action="?/signout">
							<button class="btn btn-sm btn-ghost"><Icon name="logout" size={15} /> Sign out</button
							>
						</form>
					</div>
				</section>
			</aside>
		</div>
	</div>
{/if}

<style>
	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		margin-bottom: 28px;
	}
	.stat {
		padding: 16px 18px;
		display: flex;
		flex-direction: column;
	}
	.stat-value {
		font-size: 1.75rem;
		font-weight: 750;
		letter-spacing: -0.02em;
	}
	.stat-label {
		font-size: 0.84rem;
		color: var(--text-2);
	}
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 28px;
	}
	@media (min-width: 960px) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 330px;
			align-items: start;
		}
	}
	.upcoming h3 {
		font-size: 1.05rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		background: var(--surface-2);
	}
	.cover-box {
		margin: 0 20px 16px;
		padding: 14px;
		border-radius: var(--radius);
		background: var(--amber-soft);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	@media (min-width: 720px) {
		.cover-box {
			margin: 0 24px 18px;
		}
	}
	@media (max-width: 520px) {
		.stats {
			gap: 8px;
		}
		.stat {
			padding: 12px;
		}
		.stat-value {
			font-size: 1.4rem;
		}
	}
</style>
