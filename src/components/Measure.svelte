<script lang="ts">
	import type * as GeoJSON from 'geojson';
	import type * as maplibregl from 'maplibre-gl';
	import { get } from 'svelte/store';
	import AccessibilityLayer from './layers/AccessibilityLayer.svelte';
	import BaseMap from './maps/BaseMap.svelte';
	import IndexScorecard from './controls/IndexScorecard.svelte';
	import IndexExplanationLayer from './layers/IndexExplanationLayer.svelte';
	import Legend from './plotting/Legend.svelte';
	import ToolPane from './ToolPane.svelte';
	import type { TargetStoreImpl } from '../js/types';
	import { current_accessibility_index, current_accessibility_index_data } from '../stores/stores';

	export let metadata: TargetStoreImpl;

	let map: maplibregl.Map | undefined;
	let styleLoaded = false;
	let mapLoaded = false;

	$: target = metadata?.getTarget($current_accessibility_index);
	$: values =
		$current_accessibility_index_data?.features.map((f: GeoJSON.Feature) => f.properties?.v) ?? [];
	// The grid on the map belongs to the index chosen when it arrived. Until the
	// next one lands, the legend stays hidden rather than describe the new index
	// over the old grid. `get` keeps the index out of this block's dependencies.
	$: grid_index = $current_accessibility_index_data ? get(current_accessibility_index) : undefined;
</script>

<ToolPane>
	<svelte:fragment slot="rail">
		<IndexScorecard {metadata} />
	</svelte:fragment>

	<BaseMap container="accessibility_map" bind:ref={map} bind:mapLoaded bind:styleLoaded />

	{#if target && grid_index === $current_accessibility_index}
		<Legend {values} type={target.index.type} threshold={target.threshold} />
	{/if}

	{#if map && mapLoaded && styleLoaded}
		<AccessibilityLayer {map} {metadata} />
		<IndexExplanationLayer {map} {metadata} />
	{/if}
</ToolPane>
