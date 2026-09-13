<script lang="ts">
	import { onMount, onDestroy, setContext } from 'svelte';
	import { BASEMAP_URL, key, mapbox } from '../../js/mapbox.js';
	import { current_city } from '../../stores/stores.js';

	onMount(() => {
		init();
	});

	onDestroy(() => {});

	let map: mapbox.Map;

	export let mapLoaded = false;
	export let styleLoaded = false;
	export let container: string;
	export let ref;

	const default_map_properties = {
		container: container,
		style: BASEMAP_URL,
		center: [2.1686, 41.390205],
		zoom: 0.5,
		bearing: 0,
		pitch: 0,
		projection: 'globe'
	};

	let props: {} = default_map_properties;

	// At low zooms, complete a revolution every two minutes.
	const secondsPerRevolution = 180;
	// Above zoom level 5, do not rotate.
	const maxSpinZoom = 3;
	// Rotate at intermediate speeds between zoom levels 3 and 5.
	const slowSpinZoom = 2;
	export let userInteracting = false;
	let spinEnabled = true;
	let width = 0;

	$: userInteracting = $current_city ? true : false;

	function init() {
		if (props) map = new mapbox.Map(props);
		else map = new mapbox.Map(default_map_properties);

		map.on('style.load', () => {
			styleLoaded = true;
		});

		map.on('load', async () => {
			mapLoaded = true;

			map.setFog({
				'horizon-blend': 0.02,
				color: '#006d2c',
				'high-color': '#161616',
				'space-color': '#161616',
				'star-intensity': 0.15
			});
			map.on('mousedown', () => {
				userInteracting = true;
			});

			map.on('mouseup', () => {
				userInteracting = false;
				// spinGlobe();
			});

			map.on('touchstart', () => {
				userInteracting = true;
			});

			map.on('touchend', () => {
				userInteracting = false;
				spinGlobe();
			});

			map.on('dragstart', () => {
				userInteracting = true;
			});

			map.on('dragend', () => {
				userInteracting = false;
				// spinGlobe();
			});
			map.on('pitchend', () => {
				userInteracting = false;
				// spinGlobe();
			});
			map.on('rotatestart', () => {
				userInteracting = false;
				// spinGlobe();
			});

			map.on('rotateend', () => {
				userInteracting = false;
				// spinGlobe();
			});
			map.on('moveend', () => {
				spinGlobe();
			});
			spinGlobe();
		});

		ref = map;
	}
	// https://docs.mapbox.com/mapbox-gl-js/example/globe-spin/
	function spinGlobe() {
		if ($current_city) return;

		const zoom = map.getZoom();
		if (spinEnabled && !userInteracting && zoom < maxSpinZoom) {
			let distancePerSecond = 360 / secondsPerRevolution;
			if (zoom > slowSpinZoom) {
				// Slow spinning at higher zooms
				const zoomDif = (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
				distancePerSecond *= zoomDif;
			}
			const center = map.getCenter();
			center.lng -= distancePerSecond;
			// Smoothly animate the map over one second.
			// When this animation is complete, it calls a 'moveend' event.
			map.easeTo({ center, duration: 1000, easing: (n) => n });
		}
	}
	// ##############################################################################

	setContext(key, {
		getMap: () => map
	});

	$: if (width && map) map.resize();
</script>

<div bind:clientWidth={width} style="height: 100%;">
	<div id={container} bind:clientWidth={width} style="height: 100%;" />

	{#if map}
		<slot />
	{/if}
</div>
