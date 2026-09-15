<script lang="ts">
	import AccessibilityLayer from './layers/AccessibilityLayer.svelte';
	import BaseMap from './maps/BaseMap.svelte';
	import NewIndexesSummary from './controls/NewIndexesSummary.svelte';
	import IndexExplanationLayer from './layers/IndexExplanationLayer.svelte';
	import Legend from './plotting/Legend.svelte';
	import ToolPane from './ToolPane.svelte';

	export let metadata;

	let map;
	let styleLoaded = false;
	let mapLoaded = false;

	/*
		The `onMount` that used to live here did two things, both wrong:

		- `current_accessibility_index.set('WHO')`, which clobbered the user's
		  choice. Harmless when the panel mounted once; since panels became
		  route-scoped it ran on every visit, so leaving Measure and coming back
		  silently reset the index. The default now lives in the store, set once
		  at module load.
		- `window.scrollTo` toward `getElementById('measure')` — an id that exists
		  nowhere in the source, so it scrolled to 50px for no reason. In a
		  viewport-height layout there is nothing to scroll at all.
	*/
</script>

<ToolPane>
	<svelte:fragment slot="rail">
		<NewIndexesSummary {metadata} />
		<Legend {metadata} />
	</svelte:fragment>

	<BaseMap container="accessibility_map" bind:ref={map} bind:mapLoaded bind:styleLoaded />

	{#if map && mapLoaded && styleLoaded}
		<AccessibilityLayer {map} {metadata} />
		<IndexExplanationLayer {map} {metadata} />
	{/if}
</ToolPane>
