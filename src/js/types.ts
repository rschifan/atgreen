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

export class CityStoreImpl {
	city: string;
	indexes: Map<string, number>;
	deciles: Map<string, number[]>;
	percentile: Map<string, number>;

	constructor(city: string) {
		this.city = city;
		this.indexes = new Map<string, number>();
		this.deciles = new Map<string, number[]>();
		this.percentile = new Map<string, number>();
	}

	addIndex(key: string, value: number) {
		this.indexes.set(key, value);
	}

	getIndex(key: string): number | undefined {
		return this.indexes.get(key);
	}

	addIndexDeciles(key: string, deciles: number[]) {
		this.deciles.set(key, deciles);
	}

	getIndexDeciles(key: string): number[] | undefined {
		return this.deciles.get(key);
	}

	addIndexPercentile(key: string, value: number) {
		this.percentile.set(key, value);
	}

	getPercentile(key: string): number | undefined {
		return this.percentile.get(key);
	}

	keys(): string[] {
		return [...this.indexes.keys()];
	}

	values(): number[] {
		return [...this.indexes.values()];
	}

	entries(): [string, number][] {
		return [...this.indexes.entries()];
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
 * A one-line statement of what an index requires, built from the RPC's own
 * fields rather than from prose.
 *
 *   WHO -> "≥0.5 ha within 5 min"
 *   IPP -> "9 m² per person within 30 min"
 *   ESA -> "0.5 ha within 5 min"
 *
 * The rail used to show eight bare acronyms and explain only the selected one,
 * so seven of the eight were unexplained at any moment. `target.description` is
 * a full sentence — too long for a row — and these three fields say the same
 * thing in the space available.
 */
export function describe_index_target(target: {
	threshold: number;
	index: { type: AccessibilityIndexType; size: number; distance: number };
}): string {
	const { threshold, index } = target;
	if (!index) return '';

	switch (index.type) {
		case AccessibilityIndexType.MINIMUM_DISTANCE:
			return `≥${index.size} ha within ${threshold} min`;
		case AccessibilityIndexType.PER_PERSON:
			return `${threshold} m² per person within ${index.distance} min`;
		case AccessibilityIndexType.EXPOSURE:
			return `${threshold} ha within ${index.distance} min`;
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
