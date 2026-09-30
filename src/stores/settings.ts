import { writable } from 'svelte/store';
import { DEFAULT_GLOBE_STYLE, is_globe_style, type GlobeStyle } from '../js/globe_styles';

/*
	User settings, kept in this browser's localStorage. Storage can be missing
	(server rendering) or refuse access (private windows, blocked site data), so
	every read and write is guarded and the default stands in.
*/
const KEY = 'atgreen.globe-style';

function stored(): GlobeStyle {
	try {
		const v = localStorage.getItem(KEY);
		if (is_globe_style(v)) return v;
	} catch {
		/* no storage: use the default */
	}
	return DEFAULT_GLOBE_STYLE;
}

export const globe_style = writable<GlobeStyle>(stored());

globe_style.subscribe((v) => {
	try {
		localStorage.setItem(KEY, v);
	} catch {
		/* no storage: the choice lasts until the page is closed */
	}
});
