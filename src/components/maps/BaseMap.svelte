<script lang="ts">
	/**
	 * The one map shell. It creates a MapLibre map centred on the current city,
	 * fills its stage, re-fits on resize and releases the map on teardown. A
	 * view that needs more — sources, layers, handlers — wraps it and hooks
	 * `onstyle` or `onload`, rather than building a map of its own.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { get_default_map_props, maplibregl } from '../../js/map.js';
	import { refit_zoom } from '../../js/utils';
	import { current_city } from '../../stores/stores.js';

	export let container: string;
	export let ref: maplibregl.Map | undefined;
	export let mapLoaded = false;
	export let styleLoaded = false;
	/** Runs once the style is in: the moment to add sources and layers. */
	export let onstyle: ((map: maplibregl.Map) => void) | undefined = undefined;
	/** Runs once the map has loaded: the moment to wire handlers to its layers. */
	export let onload: ((map: maplibregl.Map) => void) | undefined = undefined;

	let map: maplibregl.Map | undefined;
	let width = 0;
	let height = 0;

	onMount(() => {
		const created = new maplibregl.Map(
			get_default_map_props(container, $current_city.feature.geometry.coordinates)
		);
		created.on('style.load', () => {
			styleLoaded = true;
			onstyle?.(created);
		});
		created.on('load', () => {
			mapLoaded = true;
			onload?.(created);
		});
		map = ref = created;
	});

	onDestroy(() => {
		// A map holds a WebGL context, tile workers and request queues, and none of
		// it is released by dropping the DOM node. Browsers cap live contexts and
		// silently kill the oldest, which surfaces later as a blank map far from the
		// cause — and the tabs mount and unmount their maps all the time.
		map?.remove();
	});

	// `height` is measured, not declared, so this has a real input to react to.
	$: if (width && height && map) {
		map.resize();
		refit_zoom(map);
	}
</script>

<div class="map-root" bind:clientWidth={width} bind:clientHeight={height}>
	<div id={container} class="map-canvas"></div>

	{#if map}
		<slot />
	{/if}
</div>

<style>
	/* The map fills its stage, so no ancestor has to pass a height down. */
	.map-root {
		position: absolute;
		inset: 0;
	}

	/*
		The map's own container only, never "every div in .map-root": slotted
		content (legends, captions) is a child of .map-root too, and a legend sized
		to 100% height once became a dark band down the middle of the map.
	*/
	.map-canvas {
		width: 100%;
		height: 100%;
	}
</style>
