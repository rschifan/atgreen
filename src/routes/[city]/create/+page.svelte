<script lang="ts">
	import Create from '../../../components/Create.svelte';
	import { current_city } from '../../../stores/stores.js';
</script>

<svelte:head>
	<title>{$current_city?.text ?? 'ATGreen'} — Create</title>
</svelte:head>

{#if $current_city}
	<div class="pane">
		<Create />
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
