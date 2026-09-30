<script lang="ts">
	import { cityLabel } from '../../../js/slug';
	import Create from '../../../components/Create.svelte';
	import { current_city } from '../../../stores/stores.js';
</script>

<svelte:head>
	<title>{$current_city ? cityLabel($current_city.text) : 'ATGreen'} — Create</title>
</svelte:head>

{#if $current_city}
	<!-- ToolPane supplies the rail/stage layout; no wrapper needed here. -->
	<Create />
{/if}
