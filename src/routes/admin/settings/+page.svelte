<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '#lib/components/Icon.svelte';
	import { REPO_URL } from '#lib/version.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const s = $derived(data.settings);
	const e = $derived(form?.errors ?? ({} as Record<string, string>));
</script>

<svelte:head>
	<title>Settings · {data.org.name}</title>
</svelte:head>

<header class="page-header">
	<div>
		<h1>Settings</h1>
		<p>How your sign-up page looks and how reminders and changes work.</p>
	</div>
</header>

<div class="layout">
	<form method="POST" action="?/save" class="stack" style="--gap: 20px" use:enhance>
		{#if form?.errors}
			<div class="alert alert-error" role="alert">
				<Icon name="alert" size={18} />
				<p>Please fix the highlighted fields.</p>
			</div>
		{/if}

		<section class="card">
			<div class="card-header"><h2>Your organization</h2></div>
			<div class="card-body form-grid cols-2">
				<div class="field">
					<label for="orgName">Name</label>
					<input
						id="orgName"
						name="orgName"
						type="text"
						required
						maxlength="100"
						value={s.orgName}
						aria-invalid={e.orgName ? 'true' : undefined}
					/>
					{#if e.orgName}<p class="error-text">{e.orgName}</p>{/if}
				</div>
				<div class="field">
					<label for="contactEmail"
						>Contact email <span class="optional">(shown to volunteers)</span></label
					>
					<input
						id="contactEmail"
						name="contactEmail"
						type="email"
						value={s.contactEmail}
						aria-invalid={e.contactEmail ? 'true' : undefined}
					/>
					{#if e.contactEmail}<p class="error-text">{e.contactEmail}</p>{/if}
				</div>
				<div class="field span-all">
					<label for="tagline">Welcome message</label>
					<textarea id="tagline" name="tagline" rows="2" maxlength="300">{s.tagline}</textarea>
					<p class="hint">Shown at the top of your sign-up page.</p>
				</div>
				<div class="field">
					<label for="timezone">Time zone</label>
					<select
						id="timezone"
						name="timezone"
						value={s.timezone}
						aria-invalid={e.timezone ? 'true' : undefined}
					>
						{#each data.zones as z (z)}<option value={z}>{z.replace(/_/g, ' ')}</option>{/each}
					</select>
				</div>
				<div class="field">
					<label for="locale">Date & time format</label>
					<select id="locale" name="locale" value={s.locale}>
						{#each data.locales as [code, label] (code)}<option value={code}>{label}</option>{/each}
					</select>
				</div>
			</div>
		</section>

		<section class="card">
			<div class="card-header"><h2>Reminders</h2></div>
			<div class="card-body form-grid cols-2">
				<div class="field">
					<label for="reminderHours">Email reminders, hours before</label>
					<input
						id="reminderHours"
						name="reminderHours"
						type="text"
						inputmode="decimal"
						value={s.reminderHours.join(', ')}
						placeholder="24, 2"
						aria-invalid={e.reminderHours ? 'true' : undefined}
					/>
					{#if e.reminderHours}<p class="error-text">{e.reminderHours}</p>{:else}<p class="hint">
							Up to five, e.g. “48, 24, 2”. Leave empty to turn off.
						</p>{/if}
				</div>
				<div class="field">
					<label for="smsReminderHours">Text reminders, hours before</label>
					<input
						id="smsReminderHours"
						name="smsReminderHours"
						type="text"
						inputmode="decimal"
						value={s.smsReminderHours.join(', ')}
						placeholder="2"
						aria-invalid={e.smsReminderHours ? 'true' : undefined}
					/>
					{#if e.smsReminderHours}<p class="error-text">{e.smsReminderHours}</p>{:else}<p
							class="hint"
						>
							{data.integrations.twilio
								? 'Only for volunteers who opt in.'
								: 'Needs Twilio (see below).'}
						</p>{/if}
				</div>
				<div class="field">
					<label for="phoneCountryCode">Default country code</label>
					<input
						id="phoneCountryCode"
						name="phoneCountryCode"
						type="text"
						value={s.phoneCountryCode}
						maxlength="6"
						aria-invalid={e.phoneCountryCode ? 'true' : undefined}
					/>
					{#if e.phoneCountryCode}<p class="error-text">{e.phoneCountryCode}</p>{:else}<p
							class="hint"
						>
							Added to phone numbers typed without one.
						</p>{/if}
				</div>
			</div>
		</section>

		<section class="card">
			<div class="card-header"><h2>Changes and attendance</h2></div>
			<div class="card-body stack">
				<div class="field" style="max-width: 360px">
					<label for="cancelCutoffHours">Online cancel/switch cutoff (hours before start)</label>
					<input
						id="cancelCutoffHours"
						name="cancelCutoffHours"
						type="number"
						min="0"
						max="336"
						value={s.cancelCutoffHours}
						aria-invalid={e.cancelCutoffHours ? 'true' : undefined}
					/>
					{#if e.cancelCutoffHours}<p class="error-text">{e.cancelCutoffHours}</p>{:else}<p
							class="hint"
						>
							Inside this window volunteers can still ask for cover, so the spot never goes empty. 0
							= no limit.
						</p>{/if}
				</div>
				<label class="check"
					><input type="checkbox" name="allowSelfCheckin" checked={s.allowSelfCheckin} /><span
						><strong>Self check-in.</strong> Volunteers can tap “I’m here” on their phone from an hour
						before their shift.</span
					></label
				>
				<label class="check"
					><input type="checkbox" name="assumeAttendance" checked={s.assumeAttendance} /><span
						><strong>Count unmarked shifts as worked.</strong> Handy if you don’t take attendance; no-shows
						are still excluded.</span
					></label
				>
			</div>
			<div class="card-footer form-actions">
				<button class="btn btn-primary">Save settings</button>
			</div>
		</section>
	</form>

	<aside class="stack" style="--gap: 20px">
		<section class="card" id="integrations">
			<div class="card-header"><h2>Email & text</h2></div>
			<div class="card-body stack" style="--gap: 14px">
				<div class="integration">
					<Icon name="mail" size={18} />
					<div class="grow">
						<p class="strong">Email (SMTP)</p>
						<p class="small muted">
							{data.integrations.smtpHost
								? `Connected: ${data.integrations.smtpHost}`
								: 'Not set up'}
						</p>
					</div>
					<span class="badge {data.integrations.smtpHost ? 'badge-green' : 'badge-amber'}"
						>{data.integrations.smtpHost ? 'On' : 'Off'}</span
					>
				</div>
				<div class="integration">
					<Icon name="phone" size={18} />
					<div class="grow">
						<p class="strong">Text messages (Twilio)</p>
						<p class="small muted">{data.integrations.twilio ? 'Connected' : 'Optional'}</p>
					</div>
					<span class="badge {data.integrations.twilio ? 'badge-green' : ''}"
						>{data.integrations.twilio ? 'On' : 'Off'}</span
					>
				</div>
				<p class="small muted">
					These are set with environment variables on your server, so passwords never live in the
					database:
					<code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code>,
					<code>MAIL_FROM</code>, and optionally
					<code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>, <code>TWILIO_FROM</code>.
					<a href="{REPO_URL}#configuration" target="_blank" rel="noopener">Setup guide</a>
				</p>
				<p class="small muted">Emails are sent from <code>{data.integrations.mailFrom}</code>.</p>
				<form method="POST" action="?/testEmail" use:enhance>
					<button class="btn btn-sm"><Icon name="send" size={15} /> Send me a test email</button>
				</form>
				{#if form?.testError}<p class="error-text">{form.testError}</p>{/if}
			</div>
		</section>

		<section class="card card-body stack" style="--gap: 8px">
			<h2 style="font-size: 1rem">About this server</h2>
			<dl class="about small">
				<dt>Version</dt>
				<dd>
					<a href="{REPO_URL}/releases/tag/v{data.build.version}" target="_blank" rel="noopener"
						>v{data.build.version}</a
					>
				</dd>
				<dt>Build</dt>
				<dd>#{data.build.buildNumber} · <code>{data.build.commit.slice(0, 7)}</code></dd>
				<dt>Built</dt>
				<dd>{data.build.date.slice(0, 10)}</dd>
				<dt>Public URL</dt>
				<dd class="truncate">{data.integrations.origin}</dd>
				<dt>Database</dt>
				<dd class="truncate"><code>{data.integrations.databasePath}</code></dd>
			</dl>
			{#if !data.integrations.originConfigured}
				<div class="alert alert-warn small">
					<Icon name="alert" size={16} />
					<p>
						Set the <code>ORIGIN</code> environment variable to your public address (like
						<code>https://volunteer.example.org</code>) so links in emails and calendars work.
					</p>
				</div>
			{/if}
		</section>
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
			grid-template-columns: minmax(0, 1fr) 360px;
			align-items: start;
		}
	}
	.integration {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.integration > :global(svg) {
		color: var(--accent-text);
	}
	.about {
		display: grid;
		grid-template-columns: 90px minmax(0, 1fr);
		gap: 6px 12px;
		margin: 0;
	}
	.about dt {
		color: var(--text-3);
	}
	.about dd {
		margin: 0;
	}
</style>
