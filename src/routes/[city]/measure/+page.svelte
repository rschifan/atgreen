<script lang="ts">
	import Measure from '../../../components/Measure.svelte';
	import { current_city, metadata } from '../../../stores/stores.js';
</script>

<svelte:head>
	<title>{$current_city?.text ?? 'ATGreen'} — Measure</title>
</svelte:head>

{#if $current_city}
	<div class="pane">
		<Measure metadata={$metadata} />
	</div>
{/if}

<style>
	/* The flex column every map in this pane measures its height against. */
	.pane {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
</style>
