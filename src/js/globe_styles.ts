/**
 * How the home page globe draws the Earth and its cities. The user picks one on
 * the Settings page; each is modelled on a professional globe, and each also
 * sets how quiet the globe underneath is — the lesson those products share is
 * that the globe stays muted so the cities carry the colour.
 */
import type * as GeoJSON from 'geojson';
import type * as maplibregl from 'maplibre-gl';

export const GLOBE_STYLES = [
	{
		id: 'dots',
		label: 'Dot globe',
		credit: 'GitHub · Stripe · Vercel',
		description: 'Land drawn as a lattice of dots; cities glow green.'
	},
	{
		id: 'firefly',
		label: 'Firefly',
		credit: 'Esri',
		description: 'A dark, desaturated globe; the cities are the only colour.'
	},
	{
		id: 'relief',
		label: 'Relief',
		credit: 'Natural Earth',
		description: 'Natural colours and shaded relief; cities as white points.'
	},
	{
		id: 'lights',
		label: 'City lights',
		credit: 'Earth at night',
		description: 'Warm golden points with a soft bloom.'
	},
	{
		id: 'heat',
		label: 'Heat glow',
		credit: 'Density map',
		description: 'City density as a glowing field; clusters burn white.'
	},
	{
		id: 'spikes',
		label: 'Data spikes',
		credit: 'GitHub · Google WebGL Globe',
		description: '3D spikes rising from each city, taller for larger cities.'
	},
	{
		id: 'pings',
		label: 'Pings',
		credit: 'Stripe',
		description: 'Quiet points; a few cities at a time send out a ring.'
	}
] as const;

export type GlobeStyle = (typeof GLOBE_STYLES)[number]['id'];
export const DEFAULT_GLOBE_STYLE: GlobeStyle = 'dots';

export const is_globe_style = (v: unknown): v is GlobeStyle => GLOBE_STYLES.some((s) => s.id === v);

/** The city layers SummaryLayer has already added, which a style restyles or builds on. */
export type CityLayers = {
	source: string;
	halo: string;
	core: string;
	hover: maplibregl.ExpressionSpecification;
	cities: GeoJSON.FeatureCollection;
};

const RELIEF = 'relief';
const BORDERS = ['boundary_country_z0-4', 'boundary_country_z5-'];

/**
 * Apply a style to the landing globe. Returns a cleanup for anything it keeps
 * running (the pings animation); the layers themselves go with the map.
 */
export function apply_globe_style(
	map: maplibregl.Map,
	style: GlobeStyle,
	layers: CityLayers,
	reduced_motion = false
): () => void {
	const { source, halo, core, hover } = layers;
	const has = (id: string) => !!map.getLayer(id);
	const paint = (
		id: string,
		prop: Parameters<maplibregl.Map['setPaintProperty']>[1],
		value: Parameters<maplibregl.Map['setPaintProperty']>[2]
	) => has(id) && map.setPaintProperty(id, prop, value);
	// A soft circle under the cities, drawn beneath the core dots.
	const glow = (id: string, color: string, radius: number, opacity: number) =>
		map.addLayer(
			{
				id,
				type: 'circle',
				source,
				paint: {
					'circle-radius': radius,
					'circle-color': color,
					'circle-blur': 1,
					'circle-opacity': opacity
				}
			},
			core
		);
	// Grey the relief down so the cities are the only colour.
	const mute_relief = (saturation: number, brightness: number) => {
		paint(RELIEF, 'raster-saturation', saturation);
		paint(RELIEF, 'raster-brightness-max', brightness);
	};

	switch (style) {
		case 'dots': {
			if (has(RELIEF)) map.setLayoutProperty(RELIEF, 'visibility', 'none');
			for (const id of BORDERS) if (has(id)) map.setLayoutProperty(id, 'visibility', 'none');
			paint('background', 'background-color', '#0a1826');
			paint('water', 'fill-color', '#0a1826');
			// 8,400 points of a Fibonacci lattice kept where Natural Earth has land,
			// stored as bare [lng, lat] pairs (scripts/land-dots.mjs made them).
			let cancelled = false;
			fetch('/land-dots.json')
				.then((r) => r.json())
				.then((pairs: [number, number][]) => {
					if (cancelled || !map.getStyle()) return;
					map.addSource('land-dots', {
						type: 'geojson',
						data: {
							type: 'FeatureCollection',
							features: pairs.map((coordinates) => ({
								type: 'Feature',
								properties: {},
								geometry: { type: 'Point', coordinates }
							}))
						}
					});
					map.addLayer(
						{
							id: 'land-dots',
							type: 'circle',
							source: 'land-dots',
							paint: {
								'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 1, 1, 4, 2.6],
								'circle-color': '#5f7f8f',
								'circle-opacity': 0.75
							}
						},
						halo
					);
				})
				.catch(() => {
					/* no land dots: the cities still show on a plain globe */
				});
			glow('city-glow', '#42be65', 7, 0.55);
			paint(core, 'circle-color', '#b7f5c8');
			paint(core, 'circle-stroke-width', 0);
			paint(core, 'circle-opacity', 1);
			return () => (cancelled = true);
		}

		case 'firefly':
			mute_relief(-1, 0.34);
			paint(RELIEF, 'raster-contrast', 0.25);
			paint('water', 'fill-color', '#060d15');
			for (const id of BORDERS) paint(id, 'line-color', 'rgba(255, 255, 255, 0.08)');
			glow('city-glow-wide', '#24a148', 11, 0.28);
			glow('city-glow', '#42be65', 5, 0.7);
			paint(core, 'circle-color', '#e6ffee');
			paint(core, 'circle-stroke-width', 0);
			paint(core, 'circle-radius', ['case', hover, 4, 1.5]);
			break;

		case 'lights':
			glow('city-glow', '#ffc862', 7, 0.32);
			paint(core, 'circle-color', '#fff1cc');
			paint(core, 'circle-stroke-width', 0);
			break;

		case 'heat':
			map.addLayer(
				{
					id: 'city-heat',
					type: 'heatmap',
					source,
					paint: {
						'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 7, 3, 16, 6, 32],
						'heatmap-intensity': 0.55,
						'heatmap-opacity': 0.9,
						'heatmap-color': [
							'interpolate',
							['linear'],
							['heatmap-density'],
							0,
							'rgba(0, 0, 0, 0)',
							0.08,
							'rgba(0, 109, 44, 0.45)',
							0.3,
							'rgba(36, 161, 72, 0.8)',
							0.6,
							'#6fdc8c',
							0.85,
							'#defbe6',
							1,
							'#ffffff'
						]
					}
				},
				core
			);
			paint(core, 'circle-opacity', ['case', hover, 1, 0.55]);
			break;

		case 'spikes': {
			mute_relief(-0.6, 0.45);
			// A thin hexagonal prism per city (about 15 km across), extruded to a
			// height that grows with the square root of the city's grid size.
			const r = 0.13;
			map.addSource('city-spikes', {
				type: 'geojson',
				data: {
					type: 'FeatureCollection',
					features: layers.cities.features.map((f) => {
						const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
						const k = Math.cos((lat * Math.PI) / 180);
						const ring = Array.from({ length: 7 }, (_, i) => {
							const a = ((i % 6) * Math.PI) / 3;
							return [lng + (r * Math.cos(a)) / k, lat + r * Math.sin(a)];
						});
						return {
							type: 'Feature',
							properties: { h: 80000 + 30000 * Math.sqrt(f.properties?.nrows ?? 50) },
							geometry: { type: 'Polygon', coordinates: [ring] }
						};
					})
				}
			});
			map.addLayer({
				id: 'city-spikes',
				type: 'fill-extrusion',
				source: 'city-spikes',
				paint: {
					'fill-extrusion-height': ['get', 'h'],
					'fill-extrusion-color': '#6fdc8c',
					'fill-extrusion-opacity': 0.95,
					'fill-extrusion-vertical-gradient': true
				}
			});
			// The spike is the marker; the dot only shows on hover.
			paint(core, 'circle-opacity', ['case', hover, 1, 0]);
			break;
		}

		case 'pings': {
			mute_relief(-0.6, 0.45);
			paint(core, 'circle-color', '#d6f7e0');
			// Eight groups of cities (1 in 40 each) take turns sending out a ring,
			// so only a few rings are ever on screen. Ring size and fade are plain
			// values, not per-feature expressions, so each frame is cheap.
			const G = 8;
			for (let g = 0; g < G; g++)
				map.addLayer(
					{
						id: `city-ring-${g}`,
						type: 'circle',
						source,
						filter: ['==', ['%', ['to-number', ['id']], G * 5], g * 5],
						paint: {
							'circle-radius': 2,
							'circle-color': 'rgba(0, 0, 0, 0)',
							'circle-stroke-color': '#6fdc8c',
							'circle-stroke-width': 1.5,
							'circle-stroke-opacity': 0
						}
					},
					core
				);
			if (reduced_motion) return () => {};
			let frame = 0;
			const tick = () => {
				if (!map.getStyle() || !has('city-ring-0')) return;
				const t = (performance.now() / 4800) % 1;
				for (let g = 0; g < G; g++) {
					// Each group rings through two of the cycle's eight slots.
					const a = Math.min(1, ((((t - g / G) % 1) + 1) % 1) * G * 0.5);
					paint(`city-ring-${g}`, 'circle-radius', 2 + 14 * a);
					paint(`city-ring-${g}`, 'circle-stroke-opacity', a < 1 ? 0.9 * (1 - a) : 0);
				}
				frame = requestAnimationFrame(tick);
			};
			tick();
			return () => cancelAnimationFrame(frame);
		}

		case 'relief':
			// The globe as GlobleMap dresses it: natural colours, white city points.
			break;
	}
	return () => {};
}
