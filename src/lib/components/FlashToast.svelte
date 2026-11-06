<script lang="ts">
	import type { Flash } from '../types.ts';
	import Icon from './Icon.svelte';

	let { flash }: { flash: Flash | null } = $props();

	let visible = $state<Flash | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (!flash) return;
		visible = flash;
		clearTimeout(timer);
		timer = setTimeout(() => (visible = null), flash.type === 'error' ? 10000 : 6000);
		return () => clearTimeout(timer);
	});
</script>

<div class="toast-region" aria-live="polite" role="status">
	{#if visible}
		<div class="toast toast-{visible.type}">
			<Icon
				name={visible.type === 'success'
					? 'check-circle'
					: visible.type === 'error'
						? 'alert'
						: 'info'}
				size={20}
			/>
			<p>{visible.message}</p>
			<button type="button" class="close" onclick={() => (visible = null)} aria-label="Dismiss">
				<Icon name="x" size={16} />
			</button>
		</div>
	{/if}
</div>

<style>
	.toast-region {
		position: fixed;
		z-index: 60;
		left: 50%;
		bottom: 20px;
		transform: translateX(-50%);
		width: min(560px, calc(100vw - 24px));
		pointer-events: none;
	}
	.toast {
		pointer-events: auto;
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 14px 14px 14px 16px;
		border-radius: 12px;
		background: var(--text);
		color: var(--bg);
		box-shadow: var(--shadow-lg);
		font-weight: 500;
		animation: rise 0.22s ease-out;
	}
	.toast p {
		flex: 1;
		line-height: 1.45;
	}
	.toast :global(svg) {
		flex: none;
		margin-top: 1px;
	}
	.toast-success :global(svg:first-child) {
		color: #5ed69c;
	}
	.toast-error :global(svg:first-child) {
		color: #ff8a7d;
	}
	.toast-info :global(svg:first-child) {
		color: #82b4ff;
	}
	.close {
		background: none;
		border: 0;
		color: inherit;
		opacity: 0.7;
		cursor: pointer;
		padding: 2px;
		border-radius: 6px;
	}
	.close:hover {
		opacity: 1;
	}
	@keyframes rise {
		from {
			transform: translateY(12px);
			opacity: 0;
		}
	}
</style>
