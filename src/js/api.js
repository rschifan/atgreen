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
				console.log('response.status >= 400');
				throw new Error(response.statusText);
			}

			const json = await response.json();

			if (!json) {
				// This request will throw an error when an error is thrown or a Promise instance in the reject state is returned
				throw new Error('received not well-formed json data:', json);
			}
			// The parsed response data will be passed to the transformData hook function of the method instance, and these functions will be explained later
			return json;
		},

		// Interceptor for request failure
		// This interceptor will be entered when the request is wrong.
		// The second parameter is the method instance of the current request, you can use it to synchronize the configuration information before and after the request
		onError: async (error, method) => {
			console.log(error.message);
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

export const get_summary = alovaInstance.Get('/getcitiesboundaries', {
	headers: {
		'Content-Type': 'application/json;charset=UTF-8'
	}
});

export const get_closestpark_osm = (cityname, source, pga_size) =>
	alovaInstance.Get('/closestpark_osm', {
		headers: {
			'Content-Type': 'application/json;charset=UTF-8'
		},
		params: { cityname: cityname, source: source, pga_size: pga_size }
	});

export const get_greenareas_osm = (cityname) =>
	alovaInstance.Get('/queryosmgreen', {
		headers: {
			'Content-Type': 'application/json;charset=UTF-8'
		},
		params: { cityname: cityname }
	});

export function get_city_accessibility_band(city, band) {
	return new Promise(function (resolve, reject) {
		try {
			if (!city.endsWith('.tiff')) city = city += '.tiff';

			let response;
			let params_url = new URLSearchParams({
				city: city,
				band: band
			});
			console.log('https://atgreen.hpc4ai.unito.it/rpc/getaccessibility?' + params_url);
			response = fetch('https://atgreen.hpc4ai.unito.it/rpc/getaccessibility?' + params_url);
			resolve(response);
		} catch (error) {
			reject('get_city_accessibility_band: ' + error);
		}
	});
}

export function get_indmindistance_osm(cityname, pga_size, green_code) {
	// indmindistance_osm(cityname text, pga_size numeric, green_code text)
	return new Promise(function (resolve, reject) {
		try {
			let response;
			let params_url = new URLSearchParams({
				cityname: cityname,
				pga_size: pga_size,
				green_code: green_code
			});
			console.log('https://atgreen.hpc4ai.unito.it/rpc/indmindistance_osm?' + params_url);
			response = fetch('https://atgreen.hpc4ai.unito.it/rpc/indmindistance_osm?' + params_url);
			resolve(response);
		} catch (error) {
			reject('get_indmindistance_osm: ' + error);
		}
	});
}

export function get_indexposure_esa(cityname, pga_size, distance) {
	// indexposure_esa(cityname text, pga_size numeric, distance numeric)
	return new Promise(function (resolve, reject) {
		try {
			let response;
			let params_url = new URLSearchParams({
				cityname: cityname,
				pga_size: pga_size,
				distance: distance
			});
			console.log('https://atgreen.hpc4ai.unito.it/rpc/indexposure_esa?' + params_url);
			response = fetch('https://atgreen.hpc4ai.unito.it/rpc/indexposure_esa?' + params_url);
			resolve(response);
		} catch (error) {
			reject('get_indexposure_esa: ' + error);
		}
	});
}

export function get_indperperson_osm(cityname, pga_size, distance, green_code) {
	// indperperson_osm(cityname text, pga_size numeric, distance numeric, green_code text)
	return new Promise(function (resolve, reject) {
		try {
			let response;
			let params_url = new URLSearchParams({
				cityname: cityname,
				pga_size: pga_size,
				distance: distance,
				green_code: green_code
			});
			console.log('https://atgreen.hpc4ai.unito.it/rpc/indperperson_osm?' + params_url);
			response = fetch('https://atgreen.hpc4ai.unito.it/rpc/indperperson_osm?' + params_url);
			resolve(response);
		} catch (error) {
			reject('indperperson_osm: ' + error);
		}
	});
}

export function newgreen_mindistance_osm(cityname, pga_size, green_code, cell_id) {
	// newgreen_mindistance_osm(cityname text, pga_size numeric, green_code text, new_green_id numeric)
	return new Promise(function (resolve, reject) {
		try {
			let response;
			let params_url = new URLSearchParams({
				cityname: cityname,
				pga_size: pga_size,
				green_code: green_code,
				new_green_id: cell_id
			});
			console.log('https://atgreen.hpc4ai.unito.it/rpc/newgreen_mindistance_osm?' + params_url);
			response = fetch(
				'https://atgreen.hpc4ai.unito.it/rpc/newgreen_mindistance_osm?' + params_url
			);
			resolve(response);
		} catch (error) {
			reject('newgreen_mindistance_osm: ' + error);
		}
	});
}

export function newgreen_exposure_esa(cityname, pga_size, distance, size, cell_id) {
	// newgreen_exposure_esa(cityname text, pga_size numeric, distance numeric, newarea_size numeric, newarea_id numeric)
	return new Promise(function (resolve, reject) {
		try {
			let response;
			let params_url = new URLSearchParams({
				cityname: cityname,
				pga_size: pga_size,
				distance: distance,
				newarea_size: size,
				newarea_id: cell_id
			});
			console.log('https://atgreen.hpc4ai.unito.it/rpc/newgreen_exposure_esa?' + params_url);
			response = fetch('https://atgreen.hpc4ai.unito.it/rpc/newgreen_exposure_esa?' + params_url);
			resolve(response);
		} catch (error) {
			reject('newgreen_exposure_esa: ' + error);
		}
	});
}

export function newgreen_perperson_osm(cityname, pga_size, distance, green_code, size, cell_id) {
	// newgreen_perperson_osm(cityname text, pga_size numeric, distance numeric, green_code text, newgreen_size numeric, newgreen_id numeric)
	return new Promise(function (resolve, reject) {
		try {
			let response;
			let params_url = new URLSearchParams({
				cityname: cityname,
				pga_size: pga_size,
				distance: distance,
				green_code: green_code,
				newgreen_size: size,
				newgreen_id: cell_id
			});
			console.log('https://atgreen.hpc4ai.unito.it/rpc/newgreen_perperson_osm?' + params_url);
			response = fetch('https://atgreen.hpc4ai.unito.it/rpc/newgreen_perperson_osm?' + params_url);
			resolve(response);
		} catch (error) {
			reject('newgreen_perperson_osm: ' + error);
		}
	});
}

// export function get_city_accessibility_band(city: string, band: number) {

//     return new Promise(function (resolve, reject) {
//         try {

//             if (!city.endsWith(".tiff"))
//                 city = city += ".tiff"

//             dataLoading.set(true);
//             client
//                 .rpc('getaccessibility', { city: city, band: band })
//                 .then((response: any) => {
//                     if (!response.data.features)
//                         response.data.features = []
//                     resolve(response.data);
//                     console.log("get_city_accessibility_band: ", response.data)
//                     dataLoading.set(false);
//                 });
//         } catch (error) {
//             reject("get_city_accessibility_band: " + error)
//             dataLoading.set(false);
//         }

//     });
// }

// export async function get_city_accessibility_index(city: string, index: string) {
//     console.log("get_city_accessibility_index", city, index)

//     dataLoading.set(true);

//     let band: number | undefined = metadataStore.getBand(index);

//     console.log('[api.ts] Loading data for city:', city, 'layer:', index, 'band:', band);

//     if (band) {
//         dataLoading.set(true);
//         let accessibility_dataframe: any = await get_city_accessibility_band(city + '.tiff', band);
//         console.log('[api.ts] loaded', accessibility_dataframe.features.length, "features");
//         accessibility_dataframe.features =
//             accessibility_dataframe.features.filter((d: object) => d.properties.v >= 0)

//         console.log('[api.ts] loaded', accessibility_dataframe.features.length, "features (>=0)");
//         accessibility_data_layer.set(accessibility_dataframe);
//         dataLoading.set(false);
//     }

// }
