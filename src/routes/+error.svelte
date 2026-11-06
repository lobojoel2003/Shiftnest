<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import LogoMark from '#lib/components/LogoMark.svelte';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Page not found' : 'Something went wrong'}</title>
</svelte:head>

<main id="main" class="error-page">
	<div class="card card-body center stack" style="--gap: 14px">
		<div style="margin: 0 auto"><LogoMark size={48} /></div>
		<p class="eyebrow">Error {page.status}</p>
		<h1>{page.status === 404 ? 'We couldn’t find that page' : 'Something went wrong'}</h1>
		<p class="muted">
			{page.status === 404
				? 'The link may be old, or the event may have been removed.'
				: (page.error?.message ?? 'Please try again in a moment.')}
		</p>
		<div class="row" style="justify-content: center">
			<a class="btn btn-primary" href="/"><Icon name="calendar" size={16} /> See all shifts</a>
			<a class="btn" href="/my"><Icon name="user" size={16} /> My shifts</a>
		</div>
	</div>
</main>

<style>
	.error-page {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 24px;
	}
	.card {
		max-width: 460px;
		width: 100%;
	}
</style>
