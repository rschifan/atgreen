<script lang="ts">
	import Draw from '../../../components/Draw.svelte';
	import { current_city, metadata } from '../../../stores/stores.js';
</script>

<svelte:head>
	<title>{$current_city?.text ?? 'ATGreen'} — Draw</title>
</svelte:head>

{#if $current_city}
	<!-- ToolPane supplies the rail/stage layout; no wrapper needed here. -->
	<Draw metadata={$metadata} />
{/if}
