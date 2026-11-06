<script lang="ts">
	type Values = {
		title: string;
		summary: string;
		description: string;
		location: string;
		status: string;
	};

	let {
		values,
		errors = {},
		compact = false
	}: {
		values: Partial<Values>;
		errors?: Partial<Record<keyof Values, string>>;
		compact?: boolean;
	} = $props();
</script>

<div class="form-grid" class:cols-2={!compact}>
	<div class="field span-all">
		<label for="title">Event name</label>
		<input
			id="title"
			name="title"
			type="text"
			required
			maxlength="120"
			placeholder="e.g. Saturday Food Distribution"
			value={values.title ?? ''}
			aria-invalid={errors.title ? 'true' : undefined}
		/>
		{#if errors.title}<p class="error-text">{errors.title}</p>{/if}
	</div>
	<div class="field span-all">
		<label for="summary">One-line summary <span class="optional">(optional)</span></label>
		<input
			id="summary"
			name="summary"
			type="text"
			maxlength="200"
			placeholder="Shown on the list of opportunities"
			value={values.summary ?? ''}
		/>
	</div>
	<div class="field">
		<label for="location">Location <span class="optional">(optional)</span></label>
		<input
			id="location"
			name="location"
			type="text"
			maxlength="200"
			placeholder="Address or meeting point"
			value={values.location ?? ''}
		/>
	</div>
	<div class="field">
		<label for="status">Visibility</label>
		<select id="status" name="status" value={values.status ?? 'draft'}>
			<option value="draft">Draft: only coordinators can see it</option>
			<option value="published">Published: open for sign-ups</option>
			<option value="archived">Archived: hidden, kept for records</option>
		</select>
	</div>
	<div class="field span-all">
		<label for="description">Details for volunteers <span class="optional">(optional)</span></label>
		<textarea
			id="description"
			name="description"
			rows="5"
			maxlength="5000"
			placeholder="What to bring, where to park, who to ask for…"
			>{values.description ?? ''}</textarea
		>
	</div>
</div>
