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
export const ACOLOR_GREEN: string = ToHEX(AV_COLOR_GREEN);
export const ACOLOR_RED: string = ToHEX(AV_COLOR_RED);
export const ACOLOR_MID: string = ToHEX(AV_COLOR_MID);

export const SELECTION_COLOR = '#AA4A44';
export const TEXT_MAP_COLOR = '#BBBBBB';
export const BOUNDARY_MAP_COLOR = '#212125';
export const CITY_BOUNDARY_COLOR = '#666666';

export function ToRGBA(rgb: number[], opacity: number): string {
	return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity})`;
}

export function ToRGB(hex: string): number[] | undefined {
	// Three-digit shorthand is valid CSS and was rejected, returning undefined —
	// which no caller checks, so it propagated as undefined into colour maths.
	const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
	if (short) {
		return [1, 2, 3].map((i) => parseInt(short[i] + short[i], 16));
	}
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
		: undefined;
}

function componentToHex(c: number): string {
	const hex = c.toString(16);
	return hex.length == 1 ? '0' + hex : hex;
}

export function ToHEX(rgb: number[]): string {
	return '#' + componentToHex(rgb[0]) + componentToHex(rgb[1]) + componentToHex(rgb[2]);
}
