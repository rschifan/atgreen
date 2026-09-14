<script lang="ts">
	import { onMount } from 'svelte';
	import CitySelector from '../components/CitySelector.svelte';
	import { cities, current_city, search_active } from '../stores/stores.js';

	// Landing on the globe means no city is selected. Clear it once on mount —
	// not in a `$:` block, which has no dependencies here and so would never
	// re-run anyway — or the header keeps the last city's name after a back
	// navigation to this page.
	onMount(() => current_city.set(undefined));
</script>

<svelte:head>
	<title>ATGreen — how accessible are urban green areas?</title>
	<meta
		name="description"
		content="Measure, compare and model access to urban green areas across more than a thousand cities."
	/>
</svelte:head>

<CitySelector bind:active={$search_active} data={cities} />
