<script lang="ts">
	import { onMount, onDestroy, setContext } from 'svelte';
	import { BASEMAP_STYLE, key, maplibregl } from '../../js/map.js';
	import { current_city } from '../../stores/stores.js';

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

	let map: maplibregl.Map;

	export let mapLoaded = false;
	export let styleLoaded = false;
	export let container: string;
	export let ref;

	const default_map_properties: maplibregl.MapOptions = {
		container: container,
		style: BASEMAP_STYLE,
		center: [2.1686, 41.390205],
		zoom: 0.5,
		bearing: 0,
		pitch: 0
		// No `projection` here: MapLibre takes it from the style, or from
		// setProjection() once the style has loaded — see 'style.load' below.
	};

	let props: maplibregl.MapOptions = default_map_properties;

	// At low zooms, complete a revolution every two minutes.
	const secondsPerRevolution = 180;
	// Above zoom level 5, do not rotate.
	const maxSpinZoom = 3;
	// Rotate at intermediate speeds between zoom levels 3 and 5.
	const slowSpinZoom = 2;
	export let userInteracting = false;
	let spinEnabled = true;
	let width = 0;
	let height = 0;

	$: userInteracting = $current_city ? true : false;

	function init() {
		if (props) map = new maplibregl.Map(props);
		else map = new maplibregl.Map(default_map_properties);

		map.on('style.load', () => {
			// Mapbox accepted `projection: 'globe'` in the constructor. MapLibre
			// reads projection from the style, so it has to be set once a style is
			// in place — setting it earlier is silently overwritten by the style's
			// own (mercator) default.
			map.setProjection({ type: 'globe' });
			styleLoaded = true;
		});

		map.on('load', async () => {
			mapLoaded = true;

			/*
				MapLibre's equivalent of Mapbox's setFog. The green limb glow carries
				over; the star field does not, because MapLibre has no
				`star-intensity`. Space is left transparent instead, so the CSS star
				field on .map-root shows through around the globe.
			*/
			map.setSky({
				'sky-color': 'rgba(22, 22, 22, 0)',
				'horizon-color': '#006d2c',
				'fog-color': '#161616',
				'sky-horizon-blend': 0.5,
				'horizon-fog-blend': 0.8,
				'fog-ground-blend': 0.9,
				'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 4, 0.6, 7, 0]
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

<div class="map-root" bind:clientWidth={width} bind:clientHeight={height}>
	<div id={container} class="map-canvas" />

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
		/*
			The star field, in CSS. Mapbox drew it inside the map (star-intensity);
			MapLibre has no equivalent, so it is painted behind a transparent sky.
			Seven offset layers of single-pixel dots at different sizes and alphas,
			tiled at a size that does not divide evenly into common viewports, so
			no obvious grid shows.
		*/
		background-color: #161616;
		background-image:
			radial-gradient(1px 1px at 23px 41px, rgba(255, 255, 255, 0.7), transparent),
			radial-gradient(1px 1px at 131px 97px, rgba(255, 255, 255, 0.5), transparent),
			radial-gradient(1.5px 1.5px at 211px 173px, rgba(255, 255, 255, 0.6), transparent),
			radial-gradient(1px 1px at 67px 223px, rgba(255, 255, 255, 0.35), transparent),
			radial-gradient(1px 1px at 173px 19px, rgba(255, 255, 255, 0.45), transparent),
			radial-gradient(1px 1px at 251px 251px, rgba(255, 255, 255, 0.3), transparent),
			radial-gradient(1.5px 1.5px at 101px 157px, rgba(255, 255, 255, 0.4), transparent);
		background-size: 277px 263px;
	}

	/*
		This targets the map's own container, NOT "every div inside .map-root".

		It used to be `.map-root > :global(div)`, and <slot /> renders its content
		as a direct child of .map-root too — so the rule also sized the slotted
		legend and Draw's map header. BaseLegend is `position: absolute; bottom:
		1.5rem; max-width: 25rem` with a dark translucent background: given
		`height: 100%` it became a 400px-wide, full-height dark rectangle down the
		middle of the map, anchored at the bottom so its colour ramp overshot the
		top edge. That is the black rectangle on the Before map, and the reason the
		colour bar rendered at the top instead of above the bottom.
	*/
	.map-canvas {
		width: 100%;
		height: 100%;
	}
</style>
