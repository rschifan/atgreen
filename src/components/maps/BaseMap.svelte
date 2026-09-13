<script lang="ts">
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { onDestroy, onMount, setContext } from 'svelte';
	import type { Unsubscriber } from 'svelte/store';

	import { get_default_map_props, key, mapbox } from '../../js/mapbox.js';
	import { current_city } from '../../stores/stores.js';

	let map: mapbox.Map;

	export let mapLoaded = false;
	export let styleLoaded = false;
	export let height = 500;
	export let container: string;
	export let ref;

	let width = 0;

	let unsubscribe_current_city_event: Unsubscriber;

	function subscribe_current_city_event() {
		unsubscribe_current_city_event = current_city.subscribe((value) => {});
	}

	onMount(() => {
		console.log('BaseMap - mount');
		subscribe_current_city_event();
		init();
	});

	onDestroy(() => {
		if (unsubscribe_current_city_event) unsubscribe_current_city_event();
		console.log('BaseMap - destroy');
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

	$: if (width && height && map) map.resize();
</script>

<div bind:clientWidth={width} style="flex-grow: 1;">
	<div id={container} bind:clientWidth={width} style="height:100%;" />

	{#if map}
		<slot />
	{/if}
</div>

<style>
</style>
