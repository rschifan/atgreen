export const AV_COLOR_GREEN = [84, 180, 53]
export const AV_COLOR_RED = [178, 24, 43]
export const AV_COLOR_WHITE = [255, 255, 255]
export const ACOLOR_GREEN: string = ToHEX(AV_COLOR_GREEN);
export const ACOLOR_RED: string = ToHEX(AV_COLOR_RED);
export const ACOLOR_WHITE: string = ToHEX(AV_COLOR_WHITE);

export const SELECTION_COLOR = "#AA4A44";
export const TEXT_MAP_COLOR = "#BBBBBB";
export const BOUNDARY_MAP_COLOR = "#212125";
export const CITY_BOUNDARY_COLOR = "#666666";



export function ToRGBA(rgb: number[], opacity: number): string {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity})`
}

export function ToRGB(hex: string): number[] | undefined {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : undefined;
}

function componentToHex(c: number): string {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

export function ToHEX(rgb: number[]): string {
    return "#" + componentToHex(rgb[0]) + componentToHex(rgb[1]) + componentToHex(rgb[2])
}
