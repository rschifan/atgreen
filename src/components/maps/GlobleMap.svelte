<script lang="ts">
	import { onMount, onDestroy, setContext } from 'svelte';
	import { BASEMAP_STYLE, key, maplibregl } from '../../js/map.js';
	import { current_city } from '../../stores/stores.js';
	import { globe_style } from '../../stores/settings';

	onMount(() => {
		init();
	});

	onDestroy(() => {
		// Mapbox holds a WebGL context, tile workers and XHR queues; none of it is
		// released by dropping the DOM node. Browsers cap simultaneous contexts and
		// silently kill the oldest, which surfaces later as a blank map far from the
		// cause. Now that tabs mount lazily, maps are created and destroyed often, so
		// this matters more than when all six lived for the page's lifetime.
		spinEnabled = false; // a spin queued by spin_soon() must not touch a removed map
		map?.remove();
		// Also runs during server rendering, which has no cancelAnimationFrame.
		if (frame) cancelAnimationFrame(frame);
	});

	let map: maplibregl.Map;

	export let mapLoaded = false;
	export let styleLoaded = false;
	export let container: string;
	export let ref;
	export let userInteracting = false;
	// The y (px) where the text above the globe ends.
	export let clear_top = 0;

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
		maxPitch: 0,
		attributionControl: { compact: true }
		// No `projection` here: MapLibre takes it from the style, or from
		// setProjection() once the style has loaded — see 'style.load' below.
	};

	let props: maplibregl.MapOptions = default_map_properties;

	let width = 0;
	let height = 0;
	let root: HTMLDivElement;
	let frame = 0;
	let spinEnabled = true;
	// The zoom fit() chose for this window. The spin slows and stops relative to
	// it, so a bigger screen — which needs a higher zoom for the same framing —
	// does not also get a slower globe.
	let home_zoom = 0;

	// One revolution every three minutes, as before.
	const secondsPerRevolution = 180;

	/*
		No auto-spin for anyone who asked their system for less motion. That is
		also a crash fix: MapLibre honours the setting by finishing easeTo() at
		once, so 'moveend' fired inside the call and started the next spin, and the
		landing page died with "Maximum call stack size exceeded".
	*/
	const reduced_motion =
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	/*
		Where the globe sits and how large it is on screen: centred in the space
		below the text, which ends at `clear_top` — measured by CitySelector,
		because wrapping varies by device. Its radius is about 28% of the window
		height, so it is the subject without crowding the page; on narrow screens
		the width caps it, a little wider than the screen, so its sides run off.
	*/
	function framing(w: number, h: number) {
		const free = h - clear_top;
		const radius = Math.max(80, Math.min(w * 0.62, h * 0.28, free / 2 - 24));
		// MapLibre centres the globe in the padded box, at (h + top) / 2; a top
		// padding of clear_top puts it at the middle of the free space.
		return { padding: { left: 0, top: clear_top, right: 0, bottom: 0 }, radius };
	}

	// The text above can wrap to a new height after the map has loaded.
	$: if (mapLoaded && clear_top) fit();

	/*
		The globe's centre and radius ON SCREEN, measured rather than computed.

		MapLibre sizes the globe as worldSize / 2π / cos(centre latitude), then
		draws it through a perspective camera, so the visible disc is smaller
		than that by an amount that depends on canvas height and field of view.
		Rebuilding that here would copy MapLibre's internals and drift silently on
		the next upgrade. Instead: project points along a great circle leaving the
		centre, and keep the furthest — that point is the limb, at any zoom,
		latitude or window size. project() ignores occlusion, so points past the
		limb land back inside the disc rather than further out. Public API only.
	*/
	function measure() {
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
		return { x: o.x, y: o.y, r };
	}

	// Frame the globe for this window. The on-screen radius grows a little less
	// than 2× per zoom level under perspective, so correct a few times, measuring
	// each pass; it converges to well under a pixel.
	function fit() {
		const { padding, radius } = framing(width, height);
		map.setPadding(padding);
		// Free the zoom range while fitting; it is set again from the new home below.
		map.setMinZoom(0);
		map.setMaxZoom(22);
		for (let i = 0; i < 4; i++) {
			const r = measure().r;
			// A zero-sized canvas measures 0, and log2(x / 0) would zoom to Infinity.
			if (!(r > 0 && radius > 0)) break;
			map.setZoom(map.getZoom() + Math.log2(radius / r));
		}
		home_zoom = map.getZoom();
		/*
			The home page globe is for picking a city, not for reading streets —
			that is what the city pages are for. Like the product globes it is
			modelled on, it zooms only so far: enough to pull apart the crowded
			cities of Europe, not so far that labels pile up.
		*/
		map.setMinZoom(Math.max(0, home_zoom - 0.6));
		map.setMaxZoom(home_zoom + 2.5);
	}

	/*
		Three star layers, far to near: [px moved per degree of rotation, as a share
		of the camera's focal length; tile width; tile height]. The stars are fixed
		in the sky, so as the globe turns under the camera they slide the other way
		— the nearer layers faster, which reads as depth. Tile sizes match the CSS.
	*/
	const STAR_LAYERS = [
		[0.35, 199, 211],
		[0.6, 331, 347],
		[1, 523, 487]
	] as const;
	let stars: HTMLDivElement[] = [];

	// Everything drawn around the map follows the camera: the glow is placed on the
	// measured globe, and the stars are shifted by the centre's longitude/latitude.
	function update_space() {
		frame = 0;
		if (!map || !root) return;
		const { x, y, r } = measure();
		root.style.setProperty('--globe-x', `${x.toFixed(1)}px`);
		root.style.setProperty('--globe-y', `${y.toFixed(1)}px`);
		root.style.setProperty('--globe-r', `${r.toFixed(1)}px`);

		const c = map.getCenter();
		// Focal length in px per degree: MapLibre's camera has a 36.87° field of view,
		// so the focal length is 1.5 × the canvas height.
		const per_degree = (1.5 * height * Math.PI) / 180;
		STAR_LAYERS.forEach(([depth, tw, th], i) => {
			const k = depth * per_degree;
			if (stars[i])
				stars[i].style.transform =
					`translate3d(${((c.lng * k) % tw).toFixed(1)}px, ${((-c.lat * k) % th).toFixed(1)}px, 0)`;
		});
	}

	// At most once per frame: 'move' fires continuously while the globe spins.
	function schedule_space() {
		if (!frame) frame = requestAnimationFrame(update_space);
	}

	/*
		The landing globe is a picture of the Earth, not a street map. The dark
		basemap's roads, land use and labels are hidden; the oceans turn deep blue;
		and the land is Natural Earth's shaded relief. OpenFreeMap serves that
		raster from the same host as the style, so the CSP needs nothing new.

		The relief tiles are opaque, with white oceans, so the layer goes UNDER the
		vector water, which paints the oceans over them. maxzoom 2 caps the
		download near 1 MB for the landing view; the flight into a city zooms
		further on the same tiles, which is fine for the second it lasts.
	*/
	const KEEP = new Set(['background', 'water', 'boundary_country_z0-4', 'boundary_country_z5-']);
	function dress_globe() {
		for (const layer of map.getStyle().layers) {
			if (!KEEP.has(layer.id)) map.setLayoutProperty(layer.id, 'visibility', 'none');
		}
		const paint = (
			id: string,
			prop: Parameters<typeof map.setPaintProperty>[1],
			value: Parameters<typeof map.setPaintProperty>[2]
		) => {
			if (map.getLayer(id)) map.setPaintProperty(id, prop, value);
		};
		paint('background', 'background-color', '#1b2a22');
		paint('water', 'fill-color', '#0a1b2b');
		paint('boundary_country_z0-4', 'line-color', 'rgba(230, 240, 235, 0.22)');
		paint('boundary_country_z5-', 'line-color', 'rgba(230, 240, 235, 0.22)');

		map.addSource('relief', {
			type: 'raster',
			tiles: ['https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png'],
			tileSize: 512,
			// The home view uses zoom-2 tiles (about 1 MB); sharper ones load only
			// for the part of the globe a user zooms into.
			maxzoom: 4,
			attribution: '<a href="https://www.naturalearthdata.com/">Natural Earth</a>'
		});
		map.addLayer(
			{
				id: 'relief',
				type: 'raster',
				source: 'relief',
				// The Dot globe draws land from its own points: start the relief hidden
				// there, or its tiles download before the style gets to hide it.
				layout: { visibility: $globe_style === 'dots' ? 'none' : 'visible' },
				paint: {
					'raster-brightness-max': 0.62,
					'raster-saturation': 0.15,
					'raster-contrast': 0.12
				}
			},
			map.getLayer('water') ? 'water' : undefined
		);
	}

	$: userInteracting = $current_city ? true : false;

	// Resume the spin when an interaction ends with the globe at rest — letting go
	// of a hovered city fires no 'moveend' to restart it.
	$: if (mapLoaded && !userInteracting) spin_soon();

	function init() {
		if (props) map = new maplibregl.Map(props);
		else map = new maplibregl.Map(default_map_properties);

		map.on('style.load', () => {
			// Mapbox accepted `projection: 'globe'` in the constructor. MapLibre
			// reads projection from the style, so it has to be set once a style is
			// in place — setting it earlier is silently overwritten by the style's
			// own (mercator) default.
			map.setProjection({ type: 'globe' });
			dress_globe();
			styleLoaded = true;
		});

		map.on('load', async () => {
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
			fit();
			update_space();
			mapLoaded = true;
			map.on('move', schedule_space);
			map.on('resize', () => {
				fit();
				schedule_space();
			});

			map.on('mousedown', () => {
				userInteracting = true;
			});
			map.on('mouseup', () => {
				userInteracting = false;
			});
			map.on('touchstart', () => {
				userInteracting = true;
			});
			map.on('touchend', () => {
				userInteracting = false;
				spin_soon();
			});
			map.on('dragstart', () => {
				userInteracting = true;
			});
			map.on('dragend', () => {
				userInteracting = false;
			});
			map.on('moveend', () => {
				spin_soon();
			});
			spin_soon();
		});

		ref = map;
	}
	/*
		Every spin starts one microtask late, never inside a MapLibre event.
		MapLibre fires 'moveend' from INSIDE whichever camera call interrupts the
		spin — a gesture, a stop on hover, the next easeTo. Starting an ease right there
		re-enters the camera mid-call: the outer call then overwrites the new
		ease's frame id, the orphaned frame stays queued, and a later repaint
		throws "this._onEaseFrame is not a function". Seen on clicking a city.

		The deferred spin must then yield to any camera move already running —
		spinGlobe() checks isMoving() — or it would interrupt that move, whose
		'moveend' would queue another spin, forever.
	*/
	function spin_soon() {
		queueMicrotask(spinGlobe);
	}

	// https://docs.mapbox.com/mapbox-gl-js/example/globe-spin/
	function spinGlobe() {
		if (!map || map.isMoving()) return;
		if ($current_city || reduced_motion || !spinEnabled || userInteracting) return;

		// Full speed at the home framing, slowing over the next zoom level and
		// stopping one after that, so a user zooming in to look is not fighting it.
		const over = map.getZoom() - home_zoom;
		if (over >= 1.5) return;
		let distancePerSecond = 360 / secondsPerRevolution;
		if (over > 0.5) distancePerSecond *= 1.5 - over;

		const center = map.getCenter();
		center.lng -= distancePerSecond;
		// Smoothly animate the map over one second.
		// When this animation is complete, it calls a 'moveend' event.
		map.easeTo({ center, duration: 1000, easing: (n) => n });
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
	<!-- Decorative: three layers of stars, far to near (STAR_LAYERS). -->
	<div class="stars stars-0" bind:this={stars[0]} aria-hidden="true"></div>
	<div class="stars stars-1" bind:this={stars[1]} aria-hidden="true"></div>
	<div class="stars stars-2" bind:this={stars[2]} aria-hidden="true"></div>

	<div id={container} class="map-canvas"></div>

	{#if mapLoaded}
		<div class="shade" aria-hidden="true"></div>
	{/if}

	{#if map}
		<slot />
	{/if}
</div>

<style>
	/*
		The map fills its stage absolutely, so no ancestor has to cooperate by
		passing a height down.
	*/
	.map-root {
		position: absolute;
		inset: 0;
		overflow: hidden;
		/*
			Deep space rather than flat black: a blue-black ground with two faint
			nebulae, so the page has depth before a single star is drawn.
		*/
		background:
			radial-gradient(ellipse 55% 45% at 18% 22%, rgba(52, 88, 140, 0.16), transparent 70%),
			radial-gradient(ellipse 45% 40% at 88% 88%, rgba(36, 161, 72, 0.08), transparent 70%), #060a10;
	}

	/*
		The stars. Mapbox drew them inside the map (star-intensity); MapLibre has no
		equivalent, so they are painted here, behind a transparent sky. Each layer
		is a tile of single dots at a size that does not divide common viewports,
		oversized by one tile on every side so update_space() can slide it by up to
		a tile without exposing an edge — the slide wraps, so a tile is all it needs.
	*/
	.stars {
		position: absolute;
		pointer-events: none;
		will-change: transform;
	}
	.stars-0 {
		inset: -211px -199px;
		background-size: 199px 211px;
		background-image:
			radial-gradient(0.8px 0.8px at 17px 29px, rgba(255, 255, 255, 0.5), transparent),
			radial-gradient(0.8px 0.8px at 61px 143px, rgba(255, 255, 255, 0.4), transparent),
			radial-gradient(0.8px 0.8px at 103px 71px, rgba(220, 230, 255, 0.45), transparent),
			radial-gradient(0.8px 0.8px at 139px 181px, rgba(255, 255, 255, 0.35), transparent),
			radial-gradient(0.8px 0.8px at 181px 37px, rgba(255, 255, 255, 0.5), transparent),
			radial-gradient(0.8px 0.8px at 43px 197px, rgba(255, 255, 255, 0.3), transparent),
			radial-gradient(0.8px 0.8px at 157px 113px, rgba(255, 240, 225, 0.4), transparent),
			radial-gradient(0.8px 0.8px at 89px 7px, rgba(255, 255, 255, 0.35), transparent);
	}
	.stars-1 {
		inset: -347px -331px;
		background-size: 331px 347px;
		background-image:
			radial-gradient(1.1px 1.1px at 37px 59px, rgba(255, 255, 255, 0.75), transparent),
			radial-gradient(1.1px 1.1px at 211px 23px, rgba(255, 255, 255, 0.6), transparent),
			radial-gradient(1.1px 1.1px at 283px 199px, rgba(210, 225, 255, 0.7), transparent),
			radial-gradient(1.1px 1.1px at 113px 281px, rgba(255, 255, 255, 0.55), transparent),
			radial-gradient(1.1px 1.1px at 167px 157px, rgba(255, 245, 230, 0.65), transparent),
			radial-gradient(1.1px 1.1px at 307px 331px, rgba(255, 255, 255, 0.5), transparent);
		animation: twinkle 9s ease-in-out infinite alternate;
	}
	.stars-2 {
		inset: -487px -523px;
		background-size: 523px 487px;
		background-image:
			radial-gradient(1.6px 1.6px at 97px 137px, rgba(255, 255, 255, 0.95), transparent),
			radial-gradient(1.5px 1.5px at 389px 61px, rgba(215, 230, 255, 0.9), transparent),
			radial-gradient(1.4px 1.4px at 461px 353px, rgba(255, 255, 255, 0.85), transparent),
			radial-gradient(1.6px 1.6px at 229px 419px, rgba(255, 238, 220, 0.9), transparent),
			radial-gradient(1.3px 1.3px at 31px 311px, rgba(255, 255, 255, 0.8), transparent);
		animation: twinkle 6s ease-in-out infinite alternate-reverse;
	}
	@keyframes twinkle {
		to {
			opacity: 0.55;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.stars {
			animation: none;
		}
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
		/* Above the stars, which are positioned too and come first. */
		position: relative;
	}

	/* The map credits, dark to sit quietly on a dark page instead of a white box. */
	.map-root :global(.maplibregl-ctrl-attrib) {
		background: rgba(6, 10, 16, 0.7);
		color: var(--muted-foreground);
	}
	.map-root :global(.maplibregl-ctrl-attrib a) {
		color: var(--subtle-foreground);
	}
	.map-root :global(.maplibregl-ctrl-attrib-button) {
		filter: invert(1);
	}

	/*
		Light on the globe from the upper left: darkens the far side of the sphere
		so it reads as a ball rather than a disc. Masked to the globe's measured
		outline, because the light's centre is not the globe's.
	*/
	.shade {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(
			circle at calc(var(--globe-x) - var(--globe-r) * 0.35)
				calc(var(--globe-y) - var(--globe-r) * 0.4),
			rgba(0, 8, 16, 0) calc(var(--globe-r) * 0.45),
			rgba(0, 8, 16, 0.55) calc(var(--globe-r) * 1.45)
		);
		-webkit-mask: radial-gradient(
			circle at var(--globe-x) var(--globe-y),
			#000 var(--globe-r),
			transparent calc(var(--globe-r) + 0.5px)
		);
		mask: radial-gradient(
			circle at var(--globe-x) var(--globe-y),
			#000 var(--globe-r),
			transparent calc(var(--globe-r) + 0.5px)
		);
	}

	/*
		Light scattered well beyond the rim: a wide, faint green bloom behind the
		globe, so it sits in a glow of its own rather than on bare black.
	*/
	.map-root.lit::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: radial-gradient(
			circle at var(--globe-x) var(--globe-y),
			rgba(36, 161, 72, 0.16) var(--globe-r),
			rgba(36, 161, 72, 0.05) calc(var(--globe-r) * 1.5),
			rgba(36, 161, 72, 0) calc(var(--globe-r) * 2.2)
		);
	}

	/*
		The green glow Mapbox drew with setFog: a bright rim at the globe's edge,
		a haze fading inward over the globe and a halo fading out into space.
		Centred on the globe and sized to its measured edge (--globe-*, set by
		update_space), so it tracks zoom, drag and window size. Laid over the map
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
