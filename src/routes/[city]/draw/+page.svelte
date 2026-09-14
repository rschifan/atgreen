<script lang="ts">
	import Draw from '../../../components/Draw.svelte';
	import { current_city, metadata } from '../../../stores/stores.js';
</script>

<svelte:head>
	<title>{$current_city?.text ?? 'ATGreen'} — Draw</title>
</svelte:head>

{#if $current_city}
	<div class="pane">
		<Draw metadata={$metadata} />
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
