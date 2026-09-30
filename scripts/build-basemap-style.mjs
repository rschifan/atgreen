#!/usr/bin/env node
/*
	Generate the MapLibre style for ATGreen's self-hosted basemap.

	The basemap is a Protomaps planet build (OpenStreetMap data, ODbL) served as a
	single .pmtiles file, with its fonts and sprites, from this site's own origin.
	docs/BASEMAP.md has the server steps. This script writes the style that ties
	them together; its output is deployed next to the tiles, because a style must
	match the tile schema version it was built for and the two are updated
	together.

	Usage:
	  node scripts/build-basemap-style.mjs --origin https://atgreen.hpc4ai.unito.it
	  node scripts/build-basemap-style.mjs --origin <origin> --tiles <pmtiles url> --out <file>

	Every URL in the style is ABSOLUTE, built from --origin. MapLibre 6 rejects a
	relative sprite URL outright ("Invalid sprite URL ... must be absolute") and
	throws before any request is made — an earlier version of this script wrote
	root-relative `/basemap/...` paths and the basemap failed to load. Found by
	rendering the production build locally before shipping it.
*/
import { writeFileSync } from 'node:fs';
import { layers, namedFlavor } from '@protomaps/basemaps';

const arg = (name, fallback) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const origin = arg('origin');
if (!origin || !/^https?:\/\/[^/]+$/.test(origin)) {
	console.error('--origin is required, as scheme://host with no trailing slash,');
	console.error('e.g. --origin https://atgreen.hpc4ai.unito.it');
	process.exit(1);
}
const assets = `${origin}/basemap`;
const tiles = arg('tiles', `pmtiles://${assets}/planet.pmtiles`);
const out = arg('out', 'style.json');

/*
	`dark`, because the app is a dark UI and the data on top of it is a
	red-to-green choropleth: a light basemap would fight the colour ramp for
	attention, and satellite imagery — what Mapbox served before — competes with
	it hardest of all. The accessibility data is the point; the basemap is
	context.
*/
const style = {
	version: 8,
	name: 'ATGreen dark (Protomaps)',
	glyphs: `${assets}/fonts/{fontstack}/{range}.pbf`,
	sprite: `${assets}/sprites/dark`,
	sources: {
		protomaps: {
			type: 'vector',
			url: tiles,
			attribution:
				'<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
		}
	},
	layers: layers('protomaps', namedFlavor('dark'), { lang: 'en' })
};

writeFileSync(out, JSON.stringify(style));
console.log(`wrote ${out}: ${style.layers.length} layers, tiles=${tiles}, assets=${assets}`);
