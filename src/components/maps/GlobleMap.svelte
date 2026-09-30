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
		// Also runs during server rendering, which has no cancelAnimationFrame.
		if (glow_frame) cancelAnimationFrame(glow_frame);
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
		pitch: 0,
		// The CSS glow is a circle, which is the globe's outline only when it is
		// seen head-on. Tilted, the outline shifts off-centre and the ring would
		// visibly slide off the edge.
		maxPitch: 0
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
	let root: HTMLDivElement;
	let glow_frame = 0;

	/*
		The globe's radius ON SCREEN, measured rather than computed.

		MapLibre sizes the globe as worldSize / 2π / cos(centre latitude), then
		draws it through a perspective camera, so the visible disc is smaller
		than that by an amount that depends on canvas height and field of view.
		Rebuilding that here would copy MapLibre's internals and drift silently on
		the next upgrade. Instead: project points along a great circle leaving the
		centre, and keep the furthest — that point is the limb, at any zoom,
		latitude or window size. project() ignores occlusion, so points past the
		limb land back inside the disc rather than further out. Public API only.
	*/
	function measure_glow() {
		glow_frame = 0;
		if (!map || !root) return;
		const c = map.getCenter();
		const lat0 = (c.lat * Math.PI) / 180;
		const o = map.project(c);
		let r = 0;
		for (let deg = 1; deg <= 100; deg++) {
			const t = (deg * Math.PI) / 180;
			// Due east from the centre along a great circle (bearing 90°).
			const lat = Math.asin(Math.sin(lat0) * Math.cos(t));
			const dlng = Math.atan2(
				Math.sin(t) * Math.cos(lat0),
				Math.cos(t) - Math.sin(lat0) * Math.sin(lat)
			);
			const p = map.project([c.lng + (dlng * 180) / Math.PI, (lat * 180) / Math.PI]);
			const d = Math.hypot(p.x - o.x, p.y - o.y);
			if (Number.isFinite(d)) r = Math.max(r, d);
		}
		root.style.setProperty('--globe-x', `${o.x.toFixed(1)}px`);
		root.style.setProperty('--globe-y', `${o.y.toFixed(1)}px`);
		root.style.setProperty('--globe-r', `${r.toFixed(1)}px`);
	}

	// At most once per frame: 'move' fires continuously while the globe spins.
	function schedule_glow() {
		if (!glow_frame) glow_frame = requestAnimationFrame(measure_glow);
	}

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
				MapLibre's own atmosphere is switched OFF and the green glow is drawn
				in CSS instead (.map-root.lit::after).

				The atmosphere is a physical scattering model whose only inputs are the
				sun's position and an opacity: it has no colour setting and is always
				sky-blue. `horizon-color` does not help either — the sky shader fades
				it out whenever the camera is above the thin atmosphere, which with the
				whole globe in view it always is — so the green `horizon-color` this
				first shipped with never showed. The sky stays transparent so the CSS
				star field shows through round the globe.
			*/
			map.setSky({
				'sky-color': 'rgba(22, 22, 22, 0)',
				'atmosphere-blend': 0
			});
			measure_glow();
			map.on('move', schedule_glow);
			map.on('resize', schedule_glow);
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

<div
	class="map-root"
	class:lit={mapLoaded}
	bind:this={root}
	bind:clientWidth={width}
	bind:clientHeight={height}
>
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

	/*
		The green glow Mapbox drew with setFog: a bright rim at the globe's edge,
		a haze fading inward over the globe and a halo fading out into space.
		Centred on the globe and sized to its measured edge (--globe-*, set by
		measure_glow), so it tracks zoom, drag and window size. Laid over the map
		— outside the globe the canvas is transparent anyway — with pointer events
		passing through. Shown only once the map has loaded and been measured.
	*/
	.map-root.lit::after {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(
			circle at var(--globe-x) var(--globe-y),
			rgba(36, 161, 72, 0) calc(var(--globe-r) - 26px),
			rgba(36, 161, 72, 0.3) calc(var(--globe-r) - 4px),
			rgba(66, 190, 101, 0.95) var(--globe-r),
			rgba(36, 161, 72, 0.4) calc(var(--globe-r) + 5px),
			rgba(36, 161, 72, 0) calc(var(--globe-r) + 20px)
		);
	}
</style>
