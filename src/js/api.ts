import { createAlova } from 'alova';
import GlobalFetch from 'alova/GlobalFetch';
import SvelteHook from 'alova/svelte';
import { loading } from '../stores/stores';
import {
	AccessibilityIndexType,
	type CityCollection,
	type ComputedGrid,
	type GreenAreas,
	type Grid,
	type IndexRecord,
	type ProfilePayload
} from './types';

/** PostgREST on this site: every indicator is computed in PostgreSQL behind it. */
const RPC_BASE = 'https://atgreen.hpc4ai.unito.it/rpc';

/*
	Two clients, for two kinds of request.

	alova (below) serves the published data — the city list, the index metadata,
	a city's profile, an index's grid. It caches, so Measure and Compare share a
	band's grid rather than each fetching it, and it drives the loading overlay.

	`rpc()` serves the computations Create, Draw and Measure's explanations ask
	for, which can genuinely take a minute (alova times out at 6 s) and are never
	worth caching.
*/
const alovaInstance = createAlova({
	baseURL: RPC_BASE,
	statesHook: SvelteHook,
	requestAdapter: GlobalFetch(),
	timeout: 6000,

	cacheLogger(cache) {
		if (cache) loading.set(false);
	},

	beforeRequest() {
		loading.set(true);
	},

	responded: {
		// GlobalFetch hands over the Response; what this returns is the request's data.
		onSuccess: async (response) => {
			loading.set(false);

			if (response.status >= 400) {
				console.error('RPC returned', response.status, response.statusText);
				throw new Error(response.statusText);
			}

			const json = await response.json();
			if (!json) throw new Error('received not well-formed json data');
			return json;
		},

		onError: async (error) => {
			console.error('RPC request failed:', error.message);
			loading.set(false);
		}
	}
});

const JSON_HEADERS = { 'Content-Type': 'application/json;charset=UTF-8' };

export const get_cities_metadata = alovaInstance.Get<CityCollection>('/getcitiesinfo', {
	headers: JSON_HEADERS
});

export const get_metadata = alovaInstance.Get<IndexRecord[]>('/getindexes', {
	headers: JSON_HEADERS
});

export const get_city_profile = (city: string) =>
	alovaInstance.Get<ProfilePayload>('/getsummarybycity', {
		headers: JSON_HEADERS,
		params: { cityname: city }
	});

export const get_accessibility_layer = (city: string, band: number) =>
	alovaInstance.Get<Grid>('/getaccessibility', {
		headers: JSON_HEADERS,
		params: { city: city + '.tiff', band: band }
	});

export const get_greenareas_osm = (cityname: string) =>
	alovaInstance.Get<GreenAreas>('/queryosmgreen', {
		headers: JSON_HEADERS,
		params: { cityname: cityname }
	});

// A city-wide index can genuinely take a minute; the point of the timeout is that
// a stalled connection eventually rejects instead of hanging forever.
const RPC_TIMEOUT_MS = 120000;

/** `path` is the RPC function name, e.g. 'indmindistance_osm'. */
function rpc(path: string, params: Record<string, string | number>): Promise<Response> {
	const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
	const url = `${RPC_BASE}/${path}?${query}`;
	return fetch(url, { signal: AbortSignal.timeout(RPC_TIMEOUT_MS) });
}

/** The cells of a computed index, or null when the city has none. */
async function cells(response: Response): Promise<ComputedGrid | null> {
	if (!response.ok) throw new Error(`RPC failed: HTTP ${response.status}`);
	const json = await response.json();
	return json?.features?.length > 0 ? json : null;
}

/**
 * An index built from the user's own parameters, for Create and Draw: minimum
 * green-area size in ha, time budget in minutes (exposure and per person), and
 * the green-type subset from get_green_types_code.
 */
export async function get_custom_index(
	type: AccessibilityIndexType,
	cityname: string,
	pga_size: number,
	distance: number,
	green_code: number
) {
	switch (type) {
		case AccessibilityIndexType.EXPOSURE:
			return cells(await rpc('indexposure_esa', { cityname, pga_size, distance }));
		case AccessibilityIndexType.PER_PERSON:
			return cells(await rpc('indperperson_osm', { cityname, pga_size, distance, green_code }));
		default:
			return cells(await rpc('indmindistance_osm', { cityname, pga_size, green_code }));
	}
}

/**
 * The same index recomputed as if one cell were green, for Draw's "After" map:
 * `new_size` is the area of the new green in ha, `cell_id` the cell made green.
 */
export async function get_greened_index(
	type: AccessibilityIndexType,
	cityname: string,
	pga_size: number,
	distance: number,
	green_code: number,
	new_size: number,
	cell_id: number
) {
	switch (type) {
		case AccessibilityIndexType.EXPOSURE:
			return cells(
				await rpc('newgreen_exposure_esa', {
					cityname,
					pga_size,
					distance,
					newarea_size: new_size,
					newarea_id: cell_id
				})
			);
		case AccessibilityIndexType.PER_PERSON:
			return cells(
				await rpc('newgreen_perperson_osm', {
					cityname,
					pga_size,
					distance,
					green_code,
					newgreen_size: new_size,
					newgreen_id: cell_id
				})
			);
		default:
			return cells(
				await rpc('newgreen_mindistance_osm', {
					cityname,
					pga_size,
					green_code,
					new_green_id: cell_id
				})
			);
	}
}

/**
 * The green areas behind one cell's value, for Measure's explanation layer:
 * the nearest park (distance), or every area within reach (the other two).
 * `source` is the cell's id.
 */
export async function get_explanation(
	type: AccessibilityIndexType,
	cityname: string,
	source: number,
	pga_size: number,
	distance: number
) {
	switch (type) {
		case AccessibilityIndexType.EXPOSURE:
			return cells(
				await rpc('allareaswithindistance_esa', { cityname, source, pga_size, distance })
			);
		case AccessibilityIndexType.PER_PERSON:
			return cells(
				await rpc('exposurewithindistance_osm', { cityname, source, pga_size, distance })
			);
		default:
			return cells(await rpc('closestpark_osm', { cityname, source, pga_size }));
	}
}
