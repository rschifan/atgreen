import bbox from '@turf/bbox';
import type { mapbox } from './mapbox';

export function adjust_zoom(data: any, map: mapbox.Map, animate = false, padding = 100) {
	if (map) {
		try {
			if (data && data.features && data.features.length > 0) {
				const bb = bbox(data);

				map.fitBounds(bb, {
					maxZoom: 14,
					padding: { top: padding, bottom: padding, left: padding, right: padding },
					pitch: 0,
					bearing: 0,
					animate: animate
				});
			}
		} catch (error) {
			console.log('adjust_zoom:', error);
		}
	}
}

export function get_green_types_code(green_types: []) {
	if (green_types) {
		const types = green_types.join(',');
		switch (types) {
			case 'forests,grass,parks':
				return 0;
			case 'forests,parks':
				return 1;
			case 'grass,parks':
				return 2;
			case 'parks':
				return 3;
			case 'forests,grass':
				return 4;
			case 'forests':
				return 5;
			case 'grass':
				return 6;
		}
		return 0;
	}
}

export function create_empty_geojson() {
	return { type: 'FeatureCollection', features: [] };
}

export function create_geojson(features: []) {
	return { type: 'FeatureCollection', features: features };
}
