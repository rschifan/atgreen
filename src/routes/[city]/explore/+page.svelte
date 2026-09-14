<script lang="ts">
	import Explore from '../../../components/Explore.svelte';
	import { current_city } from '../../../stores/stores.js';
</script>

<svelte:head>
	<title>{$current_city?.text ?? 'ATGreen'} — Explore</title>
</svelte:head>

{#if $current_city}
	<div class="pane">
		<Explore />
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
