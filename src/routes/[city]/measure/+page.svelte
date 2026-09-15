<script lang="ts">
	import Measure from '../../../components/Measure.svelte';
	import { current_city, metadata } from '../../../stores/stores.js';
</script>

<svelte:head>
	<title>{$current_city?.text ?? 'ATGreen'} — Measure</title>
</svelte:head>

{#if $current_city}
	<!-- ToolPane supplies the rail/stage layout; no wrapper needed here. -->
	<Measure metadata={$metadata} />
{/if}
