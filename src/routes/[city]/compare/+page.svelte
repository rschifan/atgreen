<script lang="ts">
	import Compare from '../../../components/Compare.svelte';
	import { current_city, metadata } from '../../../stores/stores.js';
</script>

<svelte:head>
	<title>{$current_city?.text ?? 'ATGreen'} — Compare</title>
</svelte:head>

{#if $current_city}
	<div class="pane">
		<Compare metadata={$metadata} />
	</div>
{/if}

<style>
	/*
		Compare lays its two columns out with floats and inline-block, so it needs a
		block formatting context rather than the flex column the map panes use, and it
		scrolls: its content is taller than the viewport by design.
	*/
	.pane {
		flex-grow: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.pane::after {
		content: '';
		display: block;
		clear: both;
	}
</style>
