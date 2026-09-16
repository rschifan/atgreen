import { format } from 'd3';
const percentage_formatter = format('.0%');
const mq_formatter = format('.2s');

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

export const INDEX_UNIT: Record<number, string> = {
	[AccessibilityIndexType.MINIMUM_DISTANCE]: 'min',
	[AccessibilityIndexType.EXPOSURE]: 'ha',
	[AccessibilityIndexType.PER_PERSON]: 'sq m'
};

export const ClassificationScheme = { LINEAR: 'linear', LOGARITHMIC: 'logarithmic' };
export const UnitType = { SQUARE_METERS: 'mq', MINUTES: 'min', HECTARS: 'ha' };

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

		switch (this.type) {
			case AccessibilityIndexType.MINIMUM_DISTANCE:
				this.unit = UnitType.MINUTES;
				break;
			case AccessibilityIndexType.PER_PERSON:
				this.unit = UnitType.SQUARE_METERS;
				break;
			case AccessibilityIndexType.EXPOSURE:
				this.unit = UnitType.HECTARS;
				break;
			default:
				this.unit = UnitType.MINUTES;
				break;
		}
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
		this.classification =
			type == AccessibilityIndexType.MINIMUM_DISTANCE || type == AccessibilityIndexType.EXPOSURE
				? ClassificationScheme.LINEAR
				: ClassificationScheme.LOGARITHMIC;
		this.ascending = type == AccessibilityIndexType.MINIMUM_DISTANCE ? true : false;
	}

	get_tooltip(p: number, value: number): string {
		if (this.type == AccessibilityIndexType.MINIMUM_DISTANCE)
			return `${percentage_formatter(p)} of the population has access to a greenspace of at least ${
				this.size
			} ha within ${value} min.`;
		else if (this.type == AccessibilityIndexType.PER_PERSON)
			return `${percentage_formatter(p)} of the population has access within ${
				this.distance
			} minutes to ${mq_formatter(value)} mq of greenspace per person.`;
		return `${percentage_formatter(
			p
		)} of the population is exposed to ${value} ha of green areas within ${this.distance} minutes`;
	}
}

export class Target<AccessibilityIndex> {
	index: AccessibilityIndex;
	threshold: number;
	predicate: string;
	description: string;

	constructor(index: AccessibilityIndex, threshold: number, description: string) {
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

	getIndexbyBand(band: number): AccessibilityIndexImpl | undefined {
		let current: AccessibilityIndexImpl | undefined = undefined;
		this.map.forEach((item) => {
			const i: AccessibilityIndexImpl = item.index;
			if (i.band === band) current = item.index;
		});
		return current;
	}

	getBand(key: string): number | undefined {
		const current: Target<AccessibilityIndexImpl> | undefined = this.map.get(key);
		if (current) return current.index.band;
		return current;
	}

	static createInstance(data: {}): TargetStoreImpl {
		const store: TargetStoreImpl = new TargetStoreImpl();

		if (data) {
			for (const [_, current] of Object.entries(data)) {
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
