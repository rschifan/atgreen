// Mapbox's own stylesheet, imported once here rather than per component.
//
// It used to arrive twice: five map components imported it AND src/app.html linked
// it from api.mapbox.com — a render-blocking third-party request, and the same
// construct as the unversioned CDN stylesheet that broke this homepage for months.
// Deleting only the link would have broken the landing page, because GlobleMap
// imported no CSS and relied on it. Every map component imports this module, so
// this is the one place that covers all of them.
import 'mapbox-gl/dist/mapbox-gl.css';
import mapbox from 'mapbox-gl';

export let BASEMAP_URL = 'mapbox://styles/rschifan/clhngadpy01ol01pnfy4g590t';

/**
 * @param {string} container
 * @param {object} center
 */
export function get_default_map_props(container, center) {
	return {
		style: BASEMAP_URL,
		zoom: 10,
		bearing: 0,
		pitch: 0,
		container: container,
		center: center
		// cooperativeGestures: true,
		// gestureHandling: true,
		// scrollZoom: false
	};
}

let MAPBOX_ACCESS_TOKEN =
	'pk.eyJ1IjoicnNjaGlmYW4iLCJhIjoiY2p2anNyZHI4MDhzbjQ5cWl0enB0NmFjbSJ9.TCQ_YUSwqIXEo1f6GdmBZg';

// https://docs.mapbox.com/help/glossary/access-token/
mapbox.accessToken = MAPBOX_ACCESS_TOKEN;

const key = {};

export { mapbox, key };
