<script lang="ts">
	import Explore from '../../../components/Explore.svelte';
	import { current_city } from '../../../stores/stores.js';
</script>

<svelte:head>
	<title>{$current_city?.text ?? 'ATGreen'} — Explore</title>
</svelte:head>

{#if $current_city}
	<!-- ToolPane supplies the rail/stage layout; no wrapper needed here. -->
	<Explore />
{/if}
