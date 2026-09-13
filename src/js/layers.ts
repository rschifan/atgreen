import { ACOLOR_GREEN, ACOLOR_RED, ACOLOR_WHITE, TEXT_MAP_COLOR } from "./colors";
import { ClassificationScheme, AccessibilityIndexType } from "./types";


export function get_target_rule(operator: string, threshold: number) {
    return [operator, ['get', 'v'], threshold]
}

export function get_colormap_rule(
    data: number[],
    type: AccessibilityIndexType,
    classification: string,
    threshold: number) {

    let max: number = Math.max(...data);
    let min: number = Math.min(...data);

    return [
        'interpolate', ['linear'],

        classification == ClassificationScheme.LINEAR ? ['get', 'v'] : ["log2", ['get', 'v']],

        classification == ClassificationScheme.LOGARITHMIC ? min == 0 ? 0 : Math.log2(min) : min,
        type == AccessibilityIndexType.MINIMUM_DISTANCE ? ACOLOR_GREEN : ACOLOR_RED,
        classification == ClassificationScheme.LOGARITHMIC ? threshold == 0 ? 0 : Math.log2(threshold) : threshold,
        ACOLOR_WHITE,
        classification == ClassificationScheme.LOGARITHMIC ? max == 0 ? 0 : Math.log2(max) : max,
        type == AccessibilityIndexType.MINIMUM_DISTANCE ? ACOLOR_RED : ACOLOR_GREEN
    ]

}

export function get_accessibility_layer_fill_color(
    data: number[],
    type: AccessibilityIndexType,
    classification: string,
    threshold: number
) {

    return [
        'case',
        ['==', ['feature-state', 'hover'], true],
        "white",
        ['==', ['feature-state', 'selected'], true],
        "#AF5D63",
        get_colormap_rule(data, type, classification, threshold)
    ]

}


export function get_accessibility_layer_fill_opacity(){
    return ['interpolate', ['linear'], ['zoom'], 10, 1, 17, 0]
}

// export function get_accessibility_layer_fill_opacity(
//     predicate: string, threshold: number
// ) {
    
    // return [
    // 'case',
    // ['==', ['feature-state', 'selected'], true],
    // 0.4,
    // ['==', ['feature-state', 'hover'], true],
    // 1.0,
    // ['case', get_target_rule(predicate, threshold), 0.8, 0.4]
    // ]
// }








