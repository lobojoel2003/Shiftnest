<script lang="ts">
	type Values = {
		role: string;
		date: string;
		start: string;
		end: string;
		capacity: string | number;
		location: string;
		notes: string;
		repeat: string;
		count: string | number;
	};

	let {
		values,
		errors = {},
		allowRepeat = false,
		roles = [],
		idPrefix = 's'
	}: {
		values: Partial<Values>;
		errors?: Partial<Record<keyof Values, string>>;
		allowRepeat?: boolean;
		roles?: string[];
		idPrefix?: string;
	} = $props();

	// Follows the incoming values, but the select can change it locally.
	let repeat = $derived(values.repeat ?? 'none');
	const id = (name: string) => `${idPrefix}-${name}`;
</script>

<div class="form-grid cols-3">
	<div class="field span-all">
		<label for={id('role')}>Role or task</label>
		<input
			id={id('role')}
			name="role"
			type="text"
			required
			maxlength="80"
			list={roles.length ? id('roles') : undefined}
			placeholder="e.g. Sorting, Driver, Front desk"
			value={values.role ?? ''}
			aria-invalid={errors.role ? 'true' : undefined}
		/>
		{#if roles.length}
			<datalist id={id('roles')}
				>{#each roles as r (r)}<option value={r}></option>{/each}</datalist
			>
		{/if}
		{#if errors.role}<p class="error-text">{errors.role}</p>{/if}
	</div>
	<div class="field">
		<label for={id('date')}>Date</label>
		<input
			id={id('date')}
			name="date"
			type="date"
			required
			value={values.date ?? ''}
			aria-invalid={errors.date ? 'true' : undefined}
		/>
		{#if errors.date}<p class="error-text">{errors.date}</p>{/if}
	</div>
	<div class="field">
		<label for={id('start')}>Starts</label>
		<input
			id={id('start')}
			name="start"
			type="time"
			required
			value={values.start ?? ''}
			aria-invalid={errors.start ? 'true' : undefined}
		/>
		{#if errors.start}<p class="error-text">{errors.start}</p>{/if}
	</div>
	<div class="field">
		<label for={id('end')}>Ends</label>
		<input
			id={id('end')}
			name="end"
			type="time"
			required
			value={values.end ?? ''}
			aria-invalid={errors.end ? 'true' : undefined}
		/>
		{#if errors.end}<p class="error-text">{errors.end}</p>{:else}<p class="hint">
				Earlier than the start = next day
			</p>{/if}
	</div>
	<div class="field">
		<label for={id('capacity')}>Spots</label>
		<input
			id={id('capacity')}
			name="capacity"
			type="number"
			min="1"
			max="500"
			required
			value={values.capacity ?? 4}
			aria-invalid={errors.capacity ? 'true' : undefined}
		/>
		{#if errors.capacity}<p class="error-text">{errors.capacity}</p>{/if}
	</div>
	<div class="field" style="grid-column: span 2">
		<label for={id('location')}
			>Location <span class="optional">(if different from the event)</span></label
		>
		<input
			id={id('location')}
			name="location"
			type="text"
			maxlength="200"
			value={values.location ?? ''}
		/>
	</div>
	<div class="field span-all">
		<label for={id('notes')}>Notes for volunteers <span class="optional">(optional)</span></label>
		<input
			id={id('notes')}
			name="notes"
			type="text"
			maxlength="500"
			placeholder="e.g. Heavy lifting, bring gloves"
			value={values.notes ?? ''}
		/>
	</div>
	{#if allowRepeat}
		<div class="field">
			<label for={id('repeat')}>Repeat</label>
			<select id={id('repeat')} name="repeat" bind:value={repeat}>
				<option value="none">Just once</option>
				<option value="daily">Every day</option>
				<option value="weekly">Every week</option>
				<option value="biweekly">Every 2 weeks</option>
			</select>
		</div>
		{#if repeat !== 'none'}
			<div class="field">
				<label for={id('count')}>How many shifts</label>
				<input
					id={id('count')}
					name="count"
					type="number"
					min="2"
					max="52"
					value={values.count && Number(values.count) > 1 ? values.count : 4}
					aria-invalid={errors.count ? 'true' : undefined}
				/>
				{#if errors.count}<p class="error-text">{errors.count}</p>{/if}
			</div>
		{/if}
	{/if}
</div>
