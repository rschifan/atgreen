<script lang="ts">
	import { refit_zoom } from '../../js/utils';
	import { onDestroy, onMount, setContext } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';

	import { get_default_map_props, key, mapbox } from '../../js/mapbox.js';
	import { current_city } from '../../stores/stores.js';

	let map: mapbox.Map;

	export let mapLoaded = false;
	export let styleLoaded = false;
	let height: number;
	export let container: string;
	export let ref;

	let width = 0;

	onMount(() => {
		init();
	});

	onDestroy(() => {
		// Mapbox holds a WebGL context, tile workers and XHR queues; none of it is
		// released by dropping the DOM node. Browsers cap simultaneous contexts and
		// silently kill the oldest, which surfaces later as a blank map far from the
		// cause. Now that tabs mount lazily, maps are created and destroyed often, so
		// this matters more than when all six lived for the page's lifetime.
		map?.remove();
	});

	function init() {
		map = new mapbox.Map(
			get_default_map_props(container, $current_city.feature.geometry.coordinates)
		);

		map.on('style.load', () => {
			styleLoaded = true;
		});

		map.on('load', async () => {
			mapLoaded = true;
		});

		ref = map;
	}

	setContext(key, {
		getMap: () => map
	});

	$: if (width && height && map) {
		map.resize();
		refit_zoom(map);
	}
</script>

<div class="map-root" bind:clientWidth={width} bind:clientHeight={height}>
	<div id={container} />

	{#if map}
		<slot />
	{/if}
</div>

<style>
	/*
		The map fills its stage absolutely, so no ancestor has to cooperate by
		passing a height down. `height` is measured rather than declared, which
		finally gives the `$: if (width && height && map) map.resize()` guard a
		real input instead of the constant 500 it used to compare.
	*/
	.map-root {
		position: absolute;
		inset: 0;
	}

	.map-root > :global(div) {
		width: 100%;
		height: 100%;
	}
</style>
