import { html } from './utils';

export enum AccessibilityIndexType {
	MINIMUM_DISTANCE,
	EXPOSURE,
	PER_PERSON
}
/**
 * The default target per index type, and the units it is measured in.
 *
 * There were two disagreeing copies of this. `Draw`'s onMount switch said
 * {distance 5, exposure 1, per-person 10} while its own `update_colormap` said
 * {5, 0.5, 9}, and `Create` carried a third copy of the first set. /rpc/getindexes
 * settles it: ESA (exposure) has target 0.5 and IPP (per person) has 9, so the
 * update_colormap values were the correct ones and the onMount switches were not.
 *
 * Both switches also ran only in onMount, where `current_index_type` is always 0 —
 * so their exposure and per-person branches were unreachable either way.
 */
export const DEFAULT_TARGET: Record<number, number> = {
	[AccessibilityIndexType.MINIMUM_DISTANCE]: 5,
	[AccessibilityIndexType.EXPOSURE]: 0.5,
	[AccessibilityIndexType.PER_PERSON]: 9
};

/**
 * The unit each type is measured in, as the interface writes it. There were two
 * tables, and they disagreed with the rail: per-person area was "sq m" in one,
 * "mq" in the other and "m²" on screen.
 */
export const INDEX_UNIT: Record<number, string> = {
	[AccessibilityIndexType.MINIMUM_DISTANCE]: 'min',
	[AccessibilityIndexType.EXPOSURE]: 'ha',
	[AccessibilityIndexType.PER_PERSON]: 'm²'
};

export const ClassificationScheme = { LINEAR: 'linear', LOGARITHMIC: 'logarithmic' };

/**
 * How each type's colour ramp spreads its values. Green per person spans orders
 * of magnitude (Turin's cells run from 13 to 2,600 m²), so it is logarithmic.
 */
export const INDEX_CLASSIFICATION: Record<number, string> = {
	[AccessibilityIndexType.MINIMUM_DISTANCE]: ClassificationScheme.LINEAR,
	[AccessibilityIndexType.EXPOSURE]: ClassificationScheme.LINEAR,
	[AccessibilityIndexType.PER_PERSON]: ClassificationScheme.LOGARITHMIC
};

export class AccessibilityIndex {
	name: string;
	description: string;
	type: AccessibilityIndexType;
	size: number;
	distance: number;
	unit: string;

	constructor(
		name: string,
		description: string,
		type: AccessibilityIndexType,
		size: number,
		distance: number
	) {
		this.name = name;
		this.description = description;
		this.type = type;
		this.size = size;
		this.distance = distance;

		this.unit = INDEX_UNIT[type] ?? INDEX_UNIT[AccessibilityIndexType.MINIMUM_DISTANCE];
	}
}

export class AccessibilityIndexImpl extends AccessibilityIndex {
	band: number;
	classification: string;
	ascending: boolean;

	constructor(
		name: string,
		description: string,
		type: AccessibilityIndexType,
		size: number,
		distance: number,
		band: number
	) {
		super(name, description, type, size, distance);
		this.band = band;
		this.classification = INDEX_CLASSIFICATION[type];
		// Lower is better: a shorter walk.
		this.ascending = type == AccessibilityIndexType.MINIMUM_DISTANCE;
	}
}

export class Target<T extends AccessibilityIndex> {
	index: T;
	threshold: number;
	predicate: string;
	description: string;

	constructor(index: T, threshold: number, description: string) {
		this.index = index;
		this.threshold = threshold;
		this.predicate = this.get_predicate();
		this.description = description;
	}

	get_predicate(): string {
		if (this.index && this.index.type == AccessibilityIndexType.MINIMUM_DISTANCE) return '<=';
		else return '>=';
	}
}

/** One index as /rpc/getindexes returns it. */
export type IndexRecord = {
	name: string;
	band: number;
	description: string;
	target_description: string;
	target: number;
	type: 'distance' | 'exposure' | 'per person';
	size: number;
	distance: number;
	green_type: string;
};

export class TargetStoreImpl {
	map: Map<string, Target<AccessibilityIndexImpl>>;

	constructor() {
		this.map = new Map<string, Target<AccessibilityIndexImpl>>();
	}

	indexes() {
		return [...this.map.keys()];
	}

	addTargetObj(key: string, target: Target<AccessibilityIndexImpl>) {
		this.map.set(key, target);
	}

	getTarget(key: string): Target<AccessibilityIndexImpl> | undefined {
		return this.map.get(key);
	}

	getBand(key: string): number | undefined {
		const current: Target<AccessibilityIndexImpl> | undefined = this.map.get(key);
		if (current) return current.index.band;
		return current;
	}

	static createInstance(data: IndexRecord[]): TargetStoreImpl {
		const store: TargetStoreImpl = new TargetStoreImpl();

		if (data) {
			for (const current of data) {
				const key: string = current.name;
				let type: AccessibilityIndexType;

				switch (current.type) {
					case 'distance':
						type = AccessibilityIndexType.MINIMUM_DISTANCE;
						break;
					case 'exposure':
						type = AccessibilityIndexType.EXPOSURE;
						break;
					default:
						type = AccessibilityIndexType.PER_PERSON;
						break;
				}
				const current_index = new AccessibilityIndexImpl(
					key,
					current.description,
					type,
					current.size,
					type == AccessibilityIndexType.MINIMUM_DISTANCE ? current.target : current.distance,
					current.band
				);
				const current_target: Target<AccessibilityIndexImpl> = new Target<AccessibilityIndexImpl>(
					current_index,
					current.target,
					current.target_description
				);
				store.addTargetObj(key, current_target);
			}
		}
		return store;
	}
}

/**
 * What each family of index actually asks.
 *
 * The eight indexes are not peers: five measure the distance to a greenspace of
 * some minimum size, two measure green area per person, one measures total
 * exposure. That split is not a presentational invention — it is
 * `AccessibilityIndexType`, the same value that already picks the colour ramp's
 * direction, the classification scheme and the unit. Grouping the rail by it is
 * how the panel stops implying that WHO's 75% and IPP's 100% answer the same
 * question.
 */
export const INDEX_GROUP_LABEL: Record<number, string> = {
	[AccessibilityIndexType.MINIMUM_DISTANCE]: 'Distance to greenspace',
	[AccessibilityIndexType.PER_PERSON]: 'Green per person',
	[AccessibilityIndexType.EXPOSURE]: 'Exposure'
};

/** Display order of the groups: most indexes first, then the two smaller families. */
export const INDEX_GROUP_ORDER: AccessibilityIndexType[] = [
	AccessibilityIndexType.MINIMUM_DISTANCE,
	AccessibilityIndexType.PER_PERSON,
	AccessibilityIndexType.EXPOSURE
];

/**
 * What an index requires, in the few characters a rail row has: built from the
 * RPC's own fields rather than from prose. The group heading says the rest
 * ("Green per person").
 *
 *   WHO -> "≥0.5 ha · 5 min"
 *   IPP -> "9 m² · 30 min"
 *   ESA -> "0.5 ha · 5 min"
 */
export function describe_index_target(target: {
	threshold: number;
	index: { type: AccessibilityIndexType; size: number; distance: number };
}): string {
	const { threshold, index } = target;
	if (!index) return '';

	switch (index.type) {
		case AccessibilityIndexType.MINIMUM_DISTANCE:
			return `≥${index.size} ha · ${threshold} min`;
		case AccessibilityIndexType.PER_PERSON:
			return `${threshold} m² · ${index.distance} min`;
		case AccessibilityIndexType.EXPOSURE:
			return `${threshold} ha · ${index.distance} min`;
		default:
			return '';
	}
}

/** Rounded the way a reader wants it: one decimal below 100, whole numbers above. */
function readable(x: number): string {
	return x >= 100 ? Math.round(x).toLocaleString('en') : String(Math.round(x * 10) / 10);
}

/**
 * A cell's value in words, for its map popup: what the cell has, and whether
 * that meets the target. Measure and Create each built this by hand, and the
 * copies had drifted: one rounded the value and one did not, and both read
 * "of green within of 15 min walking".
 */
export function describe_cell(
	value: number,
	index: { type: AccessibilityIndexType; size: number; distance: number },
	threshold: number,
	name?: string
): string {
	const unit = INDEX_UNIT[index.type];
	const v = readable(value);
	const lead =
		index.type === AccessibilityIndexType.MINIMUM_DISTANCE
			? value === 0
				? html`A green area of at least <b>${index.size} ha</b> is within the cell.`
				: html`The nearest green area of at least <b>${index.size} ha</b> is about
						<b>${v} min</b> away on foot.`
			: index.type === AccessibilityIndexType.EXPOSURE
				? html`<b>${v} ha</b> of green within a <b>${index.distance}-minute</b> walk.`
				: html`<b>${v} m²</b> of green per resident within a <b>${index.distance}-minute</b> walk.`;
	const lower_is_better = index.type === AccessibilityIndexType.MINIMUM_DISTANCE;
	const meets = lower_is_better ? value <= threshold : value >= threshold;
	const target = name ? html`the ${name} target` : 'the target';
	const verdict = meets
		? `Meets ${target}.`
		: `Misses ${target}: ` +
			html`${v} ${unit} ${lower_is_better ? '>' : '<'} ${readable(threshold)} ${unit}.`;
	return `<p>${lead}</p><p>${verdict}</p>`;
}

/**
 * The OpenStreetMap green-area types /rpc/queryosmgreen returns, indexed by the
 * id it uses for each. Explore's picker and its map popup both read them here.
 */
export const OSM_GREEN_TYPES = [
	'village_green',
	'garden',
	'park',
	'recreation_ground',
	'grass',
	'shrubbery',
	'grassland',
	'meadow',
	'wood',
	'forest'
];

/** "recreation_ground" as people read it: "Recreation ground". */
export function green_type_label(id: number): string {
	const t = OSM_GREEN_TYPES[id];
	return t ? t[0].toUpperCase() + t.slice(1).replaceAll('_', ' ') : '';
}

type TargetLike = {
	threshold: number;
	index: { type: AccessibilityIndexType; size: number; distance: number };
};

/**
 * The same requirement as a sentence, to follow "8% of residents": what the
 * index asks every resident to have.
 */
export function describe_index_goal({ threshold, index }: TargetLike): string {
	switch (index.type) {
		case AccessibilityIndexType.MINIMUM_DISTANCE:
			return `have a green area of at least ${index.size} ha within a ${threshold}-minute walk.`;
		case AccessibilityIndexType.PER_PERSON:
			return `have ${threshold} m² of public green each within a ${index.distance}-minute walk.`;
		default:
			return `have at least ${threshold} ha of green of any kind within a ${index.distance}-minute walk.`;
	}
}

/**
 * Where the city's median resident stands, from the 20 steps of
 * /rpc/getsummarybycity's `d` (each 5% of residents, worst served first).
 */
export function describe_median({ threshold, index }: TargetLike, steps: number[]): string {
	if (steps.length < 2) return '';
	const median =
		(steps[Math.floor((steps.length - 1) / 2)] + steps[Math.ceil((steps.length - 1) / 2)]) / 2;
	const unit = INDEX_UNIT[index.type];
	if (index.type !== AccessibilityIndexType.MINIMUM_DISTANCE)
		return `The median resident has ${readable(median)} ${unit}; the target is ${threshold} ${unit}.`;
	if (median === 0) return 'Half the residents have one inside their own cell.';
	return median > threshold
		? `Half the residents walk more than ${readable(median)} min to one.`
		: `Half the residents have one within ${readable(median)} min.`;
}

/**
 * A city's standing among all cities, in words. The API's percentile `p` is the
 * share of cities doing BETTER (Turin's 75% on WHO is p 16; Khujand's 8% is
 * p 91), which the rail used to print as an ordinal: "16th" read as poor and
 * "91st" as good, the opposite of what they mean.
 */
export function standing(p: number): { label: string; tone: 'good' | 'bad' | undefined } {
	if (p <= 50) return { label: `Top ${Math.max(1, p)}%`, tone: p <= 25 ? 'good' : undefined };
	return { label: `Bottom ${100 - p}%`, tone: p >= 75 ? 'bad' : undefined };
}

/** One index's result for a city, from /rpc/getsummarybycity. */
export type IndexResult = {
	/** Share of residents who meet the target, 0–1. */
	v: number;
	/** Share of cities doing better, 0–100. */
	p: number;
	/** The city's values in 20 steps of 5% of residents, worst served first. */
	d: number[];
};

/** The RPC sends `d` as the text of a Postgres array, "[11.0, 7.6, …]". */
export function parse_profile(
	raw: Record<string, { v: number | string; p: number | string; d: string | number[] }> | null
): Record<string, IndexResult> {
	const out: Record<string, IndexResult> = {};
	for (const [name, r] of Object.entries(raw ?? {})) {
		const d = Array.isArray(r.d)
			? r.d
			: String(r.d)
					.replace(/[[\]{}]/g, '')
					.split(',');
		out[name] = { v: Number(r.v), p: Number(r.p), d: d.map(Number).filter(Number.isFinite) };
	}
	return out;
}
