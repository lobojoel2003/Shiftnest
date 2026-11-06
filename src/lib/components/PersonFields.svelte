<script lang="ts">
	import { page } from '$app/state';

	type Values = { name: string; email: string; phone: string; sms: boolean; note: string };

	let {
		values,
		errors = {},
		me = null,
		smsAvailable = false,
		showNote = true
	}: {
		values?: Partial<Values> | null;
		errors?: Partial<Record<keyof Values, string>>;
		me?: { name: string; email: string; phone: string; sms: boolean } | null;
		smsAvailable?: boolean;
		showNote?: boolean;
	} = $props();

	const v = $derived({
		name: values?.name ?? me?.name ?? '',
		email: values?.email ?? me?.email ?? '',
		phone: values?.phone ?? me?.phone ?? '',
		sms: values?.sms ?? me?.sms ?? false,
		note: values?.note ?? ''
	});
</script>

<div class="form-grid cols-2">
	<div class="field">
		<label for="name">Your name</label>
		<input
			id="name"
			name="name"
			type="text"
			autocomplete="name"
			required
			maxlength="100"
			value={v.name}
			aria-invalid={errors.name ? 'true' : undefined}
			aria-describedby={errors.name ? 'name-error' : undefined}
		/>
		{#if errors.name}<p class="error-text" id="name-error">{errors.name}</p>{/if}
	</div>

	<div class="field">
		<label for="email">Email</label>
		{#if me}
			<input id="email" type="email" value={me.email} readonly aria-describedby="email-hint" />
			<input type="hidden" name="email" value={me.email} />
			<p class="hint" id="email-hint">
				Not {me.name.split(' ')[0]}?
				<a href="/my/switch?next={encodeURIComponent(page.url.pathname)}">Use a different email</a>
			</p>
		{:else}
			<input
				id="email"
				name="email"
				type="email"
				autocomplete="email"
				inputmode="email"
				required
				maxlength="254"
				value={v.email}
				aria-invalid={errors.email ? 'true' : undefined}
				aria-describedby={errors.email ? 'email-error' : 'email-hint'}
			/>
			{#if errors.email}
				<p class="error-text" id="email-error">{errors.email}</p>
			{:else}
				<p class="hint" id="email-hint">For your confirmation and reminders. Never shared.</p>
			{/if}
		{/if}
	</div>

	<div class="field">
		<label for="phone">Mobile number <span class="optional">(optional)</span></label>
		<input
			id="phone"
			name="phone"
			type="tel"
			autocomplete="tel"
			inputmode="tel"
			maxlength="40"
			value={v.phone}
			aria-invalid={errors.phone ? 'true' : undefined}
			aria-describedby={errors.phone ? 'phone-error' : undefined}
		/>
		{#if errors.phone}<p class="error-text" id="phone-error">{errors.phone}</p>{/if}
	</div>

	{#if smsAvailable}
		<div class="field sms-field">
			<label class="check">
				<input type="checkbox" name="sms" checked={v.sms} />
				<span
					>Text me a reminder too <span class="optional"
						>(standard rates apply, reply STOP anytime)</span
					></span
				>
			</label>
		</div>
	{/if}

	{#if showNote}
		<div class="field span-all">
			<label for="note">Anything we should know? <span class="optional">(optional)</span></label>
			<textarea
				id="note"
				name="note"
				maxlength="500"
				rows="2"
				placeholder="e.g. I’m bringing my teenager, or I can stay late">{v.note}</textarea
			>
		</div>
	{/if}

	<!-- Honeypot: hidden from people, irresistible to bots. -->
	<div class="hp" aria-hidden="true">
		<label for="website">Website</label>
		<input id="website" name="website" type="text" tabindex="-1" autocomplete="off" />
	</div>
</div>

<style>
	.hp {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
	.sms-field {
		justify-content: flex-end;
		padding-bottom: 10px;
	}
</style>
