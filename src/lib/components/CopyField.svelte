<script lang="ts">
	import Icon from './Icon.svelte';

	let { value, label }: { value: string; label: string } = $props();
	let copied = $state(false);
	let input: HTMLInputElement;

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
		} catch {
			input.select();
			document.execCommand('copy');
		}
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="copy-field">
	<input
		bind:this={input}
		type="text"
		readonly
		{value}
		aria-label={label}
		onfocus={(e) => e.currentTarget.select()}
	/>
	<button type="button" class="btn btn-sm" onclick={copy} style="min-height: 42px">
		<Icon name={copied ? 'check' : 'copy'} size={16} />
		{copied ? 'Copied' : 'Copy'}
	</button>
</div>
