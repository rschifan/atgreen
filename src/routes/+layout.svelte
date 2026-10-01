<script lang="ts">
	// Tailwind and the theme the shadcn-svelte components are built on.
	import '../app.css';

	import { onMount, type Snippet } from 'svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import AppHeader from '../components/AppHeader.svelte';
	import { get_cities_metadata } from '../js/api';
	import { cities, loading } from '../stores/stores';

	let { children }: { children: Snippet } = $props();

	// One request for the whole app; the header's search and the [city] layout
	// both read the same store rather than fetching the list again.
	onMount(() => {
		get_cities_metadata.send().then(
			(list) => cities.set(list),
			(error) => console.error('The city list did not load', error)
		);
	});
</script>

<!-- Tooltips anywhere in the app share one provider (open delay, one at a time). -->
<Tooltip.Provider delayDuration={300}>
	<AppHeader />

	<main id="main-content" class="app-main">
		{@render children()}
	</main>

	{#if $loading}
		<!-- A long index computation: block input and say so, not just spin. -->
		<div
			class="loading-overlay fixed inset-0 z-[9000] grid place-items-center bg-background/60"
			role="status"
			aria-live="polite"
		>
			<span class="flex items-center gap-3 rounded-lg bg-popover px-4 py-3 text-sm shadow-lg">
				<Spinner class="size-5 text-primary" /> Computing…
			</span>
		</div>
	{/if}

	<Toaster position="bottom-right" closeButton />
</Tooltip.Provider>

<style>
	/* Below the fixed 3rem header. */
	.app-main {
		margin-top: 3rem;
		flex-grow: 1;
		display: flex;
		flex-direction: column;
	}
</style>
