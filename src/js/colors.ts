/*
	The diverging ramp for every accessibility choropleth and its legend.

	It was green -> PURE WHITE -> red. Pure white is the brightest colour a screen
	can emit, so on this dark satellite basemap the midpoint — which means "at the
	target", the least remarkable thing a cell can be — glared harder than either
	extreme, and the map read as washed-out pink. These are ColorBrewer RdYlGn's
	endpoints with its pale-yellow neutral: the two ends stay unambiguous against
	terrain, and the midpoint recedes the way a midpoint should.

	Named MID, not WHITE, because it is the value of the class break rather than a
	colour anyone should reuse for text or chrome.
*/
export const AV_COLOR_GREEN = [26, 152, 80];
export const AV_COLOR_RED = [215, 48, 39];
export const AV_COLOR_MID = [255, 255, 191];
export const ACOLOR_GREEN: string = to_hex(AV_COLOR_GREEN);
export const ACOLOR_RED: string = to_hex(AV_COLOR_RED);
export const ACOLOR_MID: string = to_hex(AV_COLOR_MID);

export const TEXT_MAP_COLOR = '#BBBBBB';
export const BOUNDARY_MAP_COLOR = '#212125';

function componentToHex(c: number): string {
	const hex = c.toString(16);
	return hex.length == 1 ? '0' + hex : hex;
}

export function to_hex(rgb: number[]): string {
	return '#' + componentToHex(rgb[0]) + componentToHex(rgb[1]) + componentToHex(rgb[2]);
}
