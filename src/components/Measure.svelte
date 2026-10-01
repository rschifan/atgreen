<script lang="ts">
	import type * as maplibregl from 'maplibre-gl';
	import { get } from 'svelte/store';
	import type { TargetStoreImpl } from '../js/types';
	import { current_accessibility_index, current_accessibility_index_data } from '../stores/stores';
	import IndexScorecard from './controls/IndexScorecard.svelte';
	import AccessibilityLayer from './layers/AccessibilityLayer.svelte';
	import IndexExplanationLayer from './layers/IndexExplanationLayer.svelte';
	import BaseMap from './maps/BaseMap.svelte';
	import Legend from './plotting/Legend.svelte';
	import ToolPane from './ToolPane.svelte';

	let { metadata }: { metadata: TargetStoreImpl | undefined } = $props();

	let map = $state.raw<maplibregl.Map>();
	let mapLoaded = $state(false);
	let styleLoaded = $state(false);

	const target = $derived(metadata?.getTarget($current_accessibility_index));
	const values = $derived(
		$current_accessibility_index_data?.features.map((f) => f.properties.v) ?? []
	);
	// The grid on the map belongs to the index chosen when it arrived. Until the
	// next one lands, the legend stays hidden rather than describe the new index
	// over the old grid. `get` keeps the index out of this one's dependencies.
	const grid_index = $derived(
		$current_accessibility_index_data ? get(current_accessibility_index) : undefined
	);
</script>

<ToolPane>
	{#snippet rail()}
		<IndexScorecard {metadata} />
	{/snippet}

	<BaseMap container="accessibility_map" bind:ref={map} bind:mapLoaded bind:styleLoaded />

	{#if target && grid_index === $current_accessibility_index}
		<Legend {values} type={target.index.type} threshold={target.threshold} />
	{/if}

	{#if map && mapLoaded && styleLoaded}
		<AccessibilityLayer {map} {metadata} />
		<IndexExplanationLayer {map} {metadata} />
	{/if}
</ToolPane>
