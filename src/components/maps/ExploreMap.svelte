<script lang="ts">
	/**
	 * Explore's map: the city's OpenStreetMap green areas, filtered by the rail,
	 * named on hover, and opened on OpenStreetMap on click.
	 */
	import type * as maplibregl from 'maplibre-gl';
	import type { Snippet } from 'svelte';
	import { BOUNDARY_MAP_COLOR } from '../../js/colors';
	import { build_greenareas_filter } from '../../js/layers';
	import { LABEL_FONT, hover_popup, track_hover } from '../../js/map';
	import { green_type_label, type GreenArea, type GreenAreas } from '../../js/types';
	import { adjust_zoom, create_empty_geojson, html } from '../../js/utils';
	import BaseMap from './BaseMap.svelte';
	import LayerControls from './LayerControls.svelte';

	let {
		container,
		data,
		green_types,
		minimum_size,
		selected_green_areas,
		children
	}: {
		container: string;
		data: GreenAreas | undefined;
		/** The green-type ids to show. */
		green_types: number[];
		minimum_size: number | undefined;
		/** Names matched by the rail's search; undefined when it is empty. */
		selected_green_areas: string[] | undefined;
		children?: Snippet;
	} = $props();

	const SOURCE = 'GREENAREAS_SOURCE';
	const LAYER = 'GREENAREAS_LAYER';
	const LABELS_LAYER = 'GREENAREAS_LABELS_LAYER';
	const OSM_ELEMENT = ['way', 'relation'];
	const popup = hover_popup();

	let map = $state.raw<maplibregl.Map>();
	// Whether the source and layers exist yet: data and filters wait for them.
	let styled = $state(false);

	function add_layers(target: maplibregl.Map) {
		target.addSource(SOURCE, { type: 'geojson', data: create_empty_geojson(), generateId: true });
		target.addLayer({
			id: LAYER,
			type: 'fill',
			source: SOURCE,
			paint: {
				'fill-color': ['case', ['boolean', ['feature-state', 'hover'], false], 'white', '#74c476'],
				'fill-opacity': 0.4
			}
		});
		target.addLayer({
			id: LABELS_LAYER,
			type: 'symbol',
			source: SOURCE,
			layout: {
				'text-field': ['get', 'osm_name'],
				'text-font': LABEL_FONT,
				'text-justify': 'auto',
				'text-size': ['interpolate', ['linear'], ['zoom'], 0, 10, 22, 14]
			},
			paint: {
				'text-halo-width': 1,
				'text-halo-color': BOUNDARY_MAP_COLOR,
				'text-color': 'white'
			}
		});
		styled = true;
	}

	function wire(target: maplibregl.Map) {
		track_hover(target, LAYER, SOURCE, (feature, e) => {
			if (!feature || !e) return void popup.remove();
			popup
				.setLngLat(e.lngLat)
				.setHTML(describe_area(feature.properties as GreenArea))
				.addTo(target);
		});
		// The popup follows the pointer across a large park, not just onto it.
		target.on('mousemove', LAYER, (e) => popup.setLngLat(e.lngLat));
		target.on('click', LAYER, (e) => {
			const p = e.features?.[0]?.properties as GreenArea | undefined;
			if (p)
				window.open(
					`https://www.openstreetmap.org/${OSM_ELEMENT[p.osm_element]}/${p.osm_id}`,
					'_blank',
					'noopener'
				);
		});
	}

	// `html` escapes every value: `osm_name` is OpenStreetMap free text, and this
	// string goes to setHTML, which assigns to innerHTML.
	function describe_area(p: GreenArea) {
		const size = (Math.round(p.size * 100) / 100).toLocaleString('en');
		return (
			(p.osm_name ? html`<p><b>${p.osm_name}</b></p>` : '') +
			html`<p>${green_type_label(p.osm_value)} · ${size} ha</p>`
		);
	}

	// The city's areas (another city's, after a switch) replace the source and frame the map.
	$effect(() => {
		if (!map || !styled || !data) return;
		map.getSource<maplibregl.GeoJSONSource>(SOURCE)?.setData(data);
		adjust_zoom(data, map);
	});

	/*
		ONE filter, not three. Each control used to call `setFilter` from its own
		reactive block with a complete replacement expression, and `setFilter` does
		not merge, so whichever ran last silently discarded the others.
		`build_greenareas_filter` composes them and is unit tested without a map.
	*/
	$effect(() => {
		if (!map || !styled) return;
		const filter = build_greenareas_filter(green_types, minimum_size, selected_green_areas);
		for (const layer of [LAYER, LABELS_LAYER]) map.setFilter(layer, filter);
	});
</script>

<BaseMap {container} bind:ref={map} onstyle={add_layers} onload={wire}>
	{@render children?.()}
</BaseMap>
{#if map}
	<LayerControls {map} layers={[LAYER, LABELS_LAYER]} {data} noun="green areas" />
{/if}
