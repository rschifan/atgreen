
import { format } from 'd3';
let percentage_formatter = format('.0%');
let mq_formatter = format('.2s');

export enum AccessibilityIndexType { MINIMUM_DISTANCE, EXPOSURE, PER_PERSON }
export const ClassificationScheme = { LINEAR: "linear", LOGARITHMIC: "logarithmic" }
export const UnitType = { SQUARE_METERS: "mq", MINUTES: "min", HECTARS: "ha" }

export class AccessibilityIndex {

    name: string;
    description: string;
    type: AccessibilityIndexType;
    size: number;
    distance: number;
    unit: string;

    constructor(name: string, description: string, type: AccessibilityIndexType, size: number, distance: number) {
        this.name = name;
        this.description = description;
        this.type = type;
        this.size = size;
        this.distance = distance

        switch (this.type) {
            case AccessibilityIndexType.MINIMUM_DISTANCE:
                this.unit = UnitType.MINUTES
                break;
            case AccessibilityIndexType.PER_PERSON:
                this.unit = UnitType.SQUARE_METERS
                break;
            case AccessibilityIndexType.EXPOSURE:
                this.unit = UnitType.HECTARS
                break;
            default:
                this.unit = UnitType.MINUTES
                break;
        }

    }
}

export class AccessibilityIndexImpl extends AccessibilityIndex {

    band: number;
    classification: string;
    ascending: boolean;

    constructor(name: string, description: string, type: AccessibilityIndexType, size: number, distance: number, band: number) {
        super(name, description, type, size, distance)
        this.band = band
        this.classification = type == AccessibilityIndexType.MINIMUM_DISTANCE || type == AccessibilityIndexType.EXPOSURE ? ClassificationScheme.LINEAR : ClassificationScheme.LOGARITHMIC;
        this.ascending = type == AccessibilityIndexType.MINIMUM_DISTANCE ? true : false;
    }


    get_tooltip(p: number, value: number): string {

        if (this.type == AccessibilityIndexType.MINIMUM_DISTANCE)
            return `${percentage_formatter(p)} of the population has access to a greenspace of at least ${this.size} ha within ${value} min.`
        else if (this.type == AccessibilityIndexType.PER_PERSON)
            return `${percentage_formatter(p)} of the population has access within ${this.distance} minutes to ${mq_formatter(value)} mq of greenspace per person.`
        return `${percentage_formatter(p)} of the population is exposed to ${value} ha of green areas within ${this.distance} minutes`
    }

}

export class Target<AccessibilityIndex> {

    index: AccessibilityIndex;
    threshold: number;
    predicate: string;
    description: string;

    constructor(index: AccessibilityIndex, threshold: number, description: string) {
        this.index = index
        this.threshold = threshold
        this.predicate = this.get_predicate()
        this.description = description;
    }

    get_predicate(): string {
        if (this.index && this.index.type == AccessibilityIndexType.MINIMUM_DISTANCE)
            return "<="
        else return ">="
    }

}

export class TargetStoreImpl {

    map: Map<string, Target<AccessibilityIndexImpl>>;

    constructor() {
        this.map = new Map<string, Target<AccessibilityIndexImpl>>();
    }


    indexes() {
        return [...this.map.keys()]
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
            let i: AccessibilityIndexImpl = item.index
            if (i.band === band) current = item.index
        });
        return current;
    }

    getBand(key: string): number | undefined {
        let current: Target<AccessibilityIndexImpl> | undefined = this.map.get(key);
        if (current)
            return current.index.band;
        return current;
    }

    static createInstance(data: {}): TargetStoreImpl {

        const store: TargetStoreImpl = new TargetStoreImpl();

        if (data) {

            for (let [_, current] of Object.entries(data)) {

                let key: string = current.name;
                let type: AccessibilityIndexType;

                switch (current.type) {
                    case "distance":
                        type = AccessibilityIndexType.MINIMUM_DISTANCE
                        break;
                    case "exposure":
                        type = AccessibilityIndexType.EXPOSURE
                        break;
                    default:
                        type = AccessibilityIndexType.PER_PERSON
                        break;
                }
                let current_index = new AccessibilityIndexImpl(
                    key,
                    current.description,
                    type,
                    current.size,
                    type == AccessibilityIndexType.MINIMUM_DISTANCE ? current.target : current.distance,
                    current.band)
                let current_target: Target<AccessibilityIndexImpl> =
                    new Target<AccessibilityIndexImpl>(current_index,
                        current.target,
                        current.target_description)
                store.addTargetObj(key, current_target);
            }

        }
        return store
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
        this.percentile.set(key, value)
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
