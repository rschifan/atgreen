import { createAlova } from 'alova';
import GlobalFetch from 'alova/GlobalFetch';
import SvelteHook from 'alova/svelte';
import { loading } from '../stores/stores';

const alovaInstance = createAlova({
	baseURL: 'https://atgreen.hpc4ai.unito.it/rpc',
	statesHook: SvelteHook,
	requestAdapter: GlobalFetch(),

	cacheLogger(cache) {
		if (cache) loading.set(false);
	},

	beforeRequest(method) {
		loading.set(true);
	},

	//...
	// Use two items of the array to specify the interceptor for successful request and the interceptor for failed request
	responded: {
		// on: async () => {

		//     console.log("fuck!")
		//     loading.set(false);

		// },

		// request success interceptor
		// When using the GlobalFetch request adapter, the first parameter receives the Response object
		// The second parameter is the method instance of the current request, you can use it to synchronize the configuration information before and after the request
		onSuccess: async (response, method) => {
			loading.set(false);

			if (response.status >= 400) {
				console.error('RPC returned', response.status, response.statusText);
				throw new Error(response.statusText);
			}

			const json = await response.json();

			if (!json) {
				// This request will throw an error when an error is thrown or a Promise instance in the reject state is returned
				// `new Error(message, value)` silently discards the value — the second
				// argument is ErrorOptions, not a format argument.
				throw new Error('received not well-formed json data');
			}
			// The parsed response data will be passed to the transformData hook function of the method instance, and these functions will be explained later
			return json;
		},

		// Interceptor for request failure
		// This interceptor will be entered when the request is wrong.
		// The second parameter is the method instance of the current request, you can use it to synchronize the configuration information before and after the request
		onError: async (error, method) => {
			console.error('RPC request failed:', error.message);
			loading.set(false);
		}
	},
	timeout: 6000
});

// const filterTodoList = text => {
//     return alovaInstance.Get('/todo/list/search', {
//         params: {
//             keyword: text
//         }
//     });
// };

export const get_cities_metadata = alovaInstance.Get('/getcitiesinfo', {
	headers: {
		'Content-Type': 'application/json;charset=UTF-8'
	}
});

export const get_accessibility_layer = (city, band) =>
	alovaInstance.Get('/getaccessibility', {
		headers: {
			'Content-Type': 'application/json;charset=UTF-8'
		},
		params: { city: city + '.tiff', band: band }
	});

export const get_city_profile = (city) =>
	alovaInstance.Get('/getsummarybycity', {
		headers: {
			'Content-Type': 'application/json;charset=UTF-8'
		},
		params: { cityname: city }
	});

export const get_metadata = alovaInstance.Get('/getindexes', {
	headers: {
		'Content-Type': 'application/json;charset=UTF-8'
	}
});

export const get_greenareas_osm = (cityname) =>
	alovaInstance.Get('/queryosmgreen', {
		headers: {
			'Content-Type': 'application/json;charset=UTF-8'
		},
		params: { cityname: cityname }
	});

/**
 * One place where every raw RPC call is made.
 *
 * The seven functions below each wrapped `fetch` in `new Promise(resolve, reject)`
 * whose try/catch could only ever catch a synchronous URLSearchParams error — the
 * reject branch was dead for network failures — and none had a timeout, so a
 * stalled request hung its caller indefinitely with the loading overlay up. They
 * also logged every URL and its parameters to the console.
 *
 * The contract is unchanged: this resolves to a Response, so callers keep doing
 * their own `response.ok` check and `.json()`. Collapsing these onto the alova
 * client — which resolves to parsed JSON — would change that contract at every
 * call site in Create and Draw, the two least test-covered views, so it is left
 * as separate work rather than done blind.
 */
const RPC_BASE = 'https://atgreen.hpc4ai.unito.it/rpc';
// A city-wide index can genuinely take a minute; the point of the timeout is that
// a stalled connection eventually rejects instead of hanging forever.
const RPC_TIMEOUT_MS = 120000;

/**
 * @param {string} path RPC function name, e.g. 'getaccessibility'
 * @param {Record<string, string | number>} params query parameters
 * @returns {Promise<Response>}
 */
function rpc(path, params) {
	const url = `${RPC_BASE}/${path}?${new URLSearchParams(params)}`;
	return fetch(url, { signal: AbortSignal.timeout(RPC_TIMEOUT_MS) });
}

/** @param {string} city @param {number} band @returns {Promise<Response>} */
export function get_city_accessibility_band(city, band) {
	const filename = city.endsWith('.tiff') ? city : `${city}.tiff`;
	return rpc('getaccessibility', { city: filename, band });
}

/** @param {string} cityname @param {number} pga_size @param {number} green_code @returns {Promise<Response>} */
export function get_indmindistance_osm(cityname, pga_size, green_code) {
	// indmindistance_osm(cityname text, pga_size numeric, green_code text)
	return rpc('indmindistance_osm', { cityname, pga_size, green_code });
}

/** @param {string} cityname @param {number} pga_size @param {number} distance @returns {Promise<Response>} */
export function get_indexposure_esa(cityname, pga_size, distance) {
	// indexposure_esa(cityname text, pga_size numeric, distance numeric)
	return rpc('indexposure_esa', { cityname, pga_size, distance });
}

/** @param {string} cityname @param {number} pga_size @param {number} distance @param {number} green_code @returns {Promise<Response>} */
export function get_indperperson_osm(cityname, pga_size, distance, green_code) {
	// indperperson_osm(cityname text, pga_size numeric, distance numeric, green_code text)
	return rpc('indperperson_osm', { cityname, pga_size, distance, green_code });
}

/** @param {string} cityname @param {number} pga_size @param {number} green_code @param {number} cell_id @returns {Promise<Response>} */
export function newgreen_mindistance_osm(cityname, pga_size, green_code, cell_id) {
	// newgreen_mindistance_osm(cityname text, pga_size numeric, green_code text, new_green_id numeric)
	return rpc('newgreen_mindistance_osm', { cityname, pga_size, green_code, new_green_id: cell_id });
}

/** @param {string} cityname @param {number} pga_size @param {number} distance @param {number} size @param {number} cell_id @returns {Promise<Response>} */
export function newgreen_exposure_esa(cityname, pga_size, distance, size, cell_id) {
	// newgreen_exposure_esa(cityname text, pga_size numeric, distance numeric, newarea_size numeric, newarea_id numeric)
	return rpc('newgreen_exposure_esa', {
		cityname,
		pga_size,
		distance,
		newarea_size: size,
		newarea_id: cell_id
	});
}

/** @param {string} cityname @param {number} pga_size @param {number} distance @param {number} green_code @param {number} size @param {number} cell_id @returns {Promise<Response>} */
export function newgreen_perperson_osm(cityname, pga_size, distance, green_code, size, cell_id) {
	// newgreen_perperson_osm(cityname text, pga_size numeric, distance numeric, green_code text, newgreen_size numeric, newgreen_id numeric)
	return rpc('newgreen_perperson_osm', {
		cityname,
		pga_size,
		distance,
		green_code,
		newgreen_size: size,
		newgreen_id: cell_id
	});
}
