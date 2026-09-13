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
    }
};


let MAPBOX_ACCESS_TOKEN =
    'pk.eyJ1IjoicnNjaGlmYW4iLCJhIjoiY2p2anNyZHI4MDhzbjQ5cWl0enB0NmFjbSJ9.TCQ_YUSwqIXEo1f6GdmBZg';

// https://docs.mapbox.com/help/glossary/access-token/
mapbox.accessToken = MAPBOX_ACCESS_TOKEN;

const key = {};

export { mapbox, key };