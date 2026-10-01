import { describe, expect, it } from 'vitest';
import {
	AccessibilityIndexType,
	INDEX_GROUP_LABEL,
	INDEX_GROUP_ORDER,
	TargetStoreImpl,
	describe_cell,
	describe_index_target,
	green_type_label
} from './types';

// Shaped exactly like the live /rpc/getindexes payload.
const INDEXES = [
	{
		name: 'WHO',
		band: 4,
		description: 'measures the distance to the closest greenspace of at least 0.5ha.',
		target_description: 'All residential areas should have access to 0.5ha within 5 minutes.',
		target: 5,
		type: 'distance',
		size: 0.5,
		distance: -1,
		green_type: 'parks, forests, grass'
	},
	{
		name: 'IPP',
		band: 28,
		description: 'greenspace per person.',
		target_description: '9 sq m per inhabitant.',
		target: 9,
		type: 'per person',
		size: 0.5,
		distance: 5,
		green_type: 'parks, forests, grass'
	},
	{
		name: 'ESA',
		band: 32,
		description: 'exposure to green.',
		target_description: '0.5 ha within 5 minutes.',
		target: 0.5,
		type: 'exposure',
		size: 0.01,
		distance: 5,
		green_type: 'parks, forests, grass'
	}
];

describe('TargetStoreImpl.createInstance', () => {
	const store = TargetStoreImpl.createInstance(INDEXES as never);

	it('keys every index by name', () => {
		expect(store.indexes()).toEqual(['WHO', 'IPP', 'ESA']);
	});

	it('maps the API type strings onto the enum', () => {
		expect(store.getTarget('WHO')?.index.type).toBe(AccessibilityIndexType.MINIMUM_DISTANCE);
		expect(store.getTarget('IPP')?.index.type).toBe(AccessibilityIndexType.PER_PERSON);
		expect(store.getTarget('ESA')?.index.type).toBe(AccessibilityIndexType.EXPOSURE);
	});

	it('derives the unit from the type', () => {
		// As the rail writes them: the per-person unit was "mq" here and "m²" on screen.
		expect(store.getTarget('WHO')?.index.unit).toBe('min');
		expect(store.getTarget('IPP')?.index.unit).toBe('m²');
		expect(store.getTarget('ESA')?.index.unit).toBe('ha');
	});

	it('resolves a band from an index name', () => {
		expect(store.getBand('WHO')).toBe(4);
		expect(store.getBand('ESA')).toBe(32);
	});

	it('returns undefined for an unknown index rather than throwing', () => {
		expect(store.getBand('NOPE')).toBeUndefined();
		expect(store.getTarget('NOPE')).toBeUndefined();
	});

	it('survives an empty payload', () => {
		expect(TargetStoreImpl.createInstance([] as never).indexes()).toEqual([]);
	});

	describe('predicate direction', () => {
		it('is <= for distance (lower is better) and >= for the others', () => {
			expect(store.getTarget('WHO')?.get_predicate()).toBe('<=');
			expect(store.getTarget('IPP')?.get_predicate()).toBe('>=');
			expect(store.getTarget('ESA')?.get_predicate()).toBe('>=');
		});
	});

	describe('distance field', () => {
		// For a distance index the constructor is handed `target`, not `distance` — the
		// API reports distance: -1 for those, which would otherwise leak into tooltips.
		it('uses target as the distance for minimum-distance indexes', () => {
			expect(store.getTarget('WHO')?.index.distance).toBe(5);
		});

		it('uses the reported distance for the others', () => {
			expect(store.getTarget('IPP')?.index.distance).toBe(5);
		});
	});
});

describe('describe_index_target', () => {
	// The real values from /rpc/getindexes, so these break if the RPC's shape moves.
	const distance = {
		threshold: 5,
		index: { type: AccessibilityIndexType.MINIMUM_DISTANCE, size: 0.5, distance: -1 }
	};
	const perPerson = {
		threshold: 9,
		index: { type: AccessibilityIndexType.PER_PERSON, size: 0.5, distance: 30 }
	};
	const exposure = {
		threshold: 0.5,
		index: { type: AccessibilityIndexType.EXPOSURE, size: 0.01, distance: 5 }
	};

	it('states what each family of index requires', () => {
		expect(describe_index_target(distance)).toBe('≥0.5 ha within 5 min');
		expect(describe_index_target(perPerson)).toBe('9 m² per person within 30 min');
		expect(describe_index_target(exposure)).toBe('0.5 ha within 5 min');
	});

	it('reads the threshold for distance and the distance for the others', () => {
		// A distance index carries `distance: -1` from the RPC and its target IS the
		// time budget; the other two carry a real distance and a target in their own
		// unit. Getting these the wrong way round produces "-1 min" on screen.
		expect(describe_index_target(distance)).not.toContain('-1');
		expect(describe_index_target(perPerson)).toContain('30 min');
		expect(describe_index_target(exposure)).toContain('5 min');
	});

	it('returns an empty string rather than throwing when the index is missing', () => {
		expect(describe_index_target({ threshold: 5, index: undefined as never })).toBe('');
	});
});

describe('INDEX_GROUP_ORDER', () => {
	it('covers every index type exactly once and has a label for each', () => {
		const types = [
			AccessibilityIndexType.MINIMUM_DISTANCE,
			AccessibilityIndexType.EXPOSURE,
			AccessibilityIndexType.PER_PERSON
		];
		expect([...INDEX_GROUP_ORDER].sort()).toEqual([...types].sort());
		for (const t of INDEX_GROUP_ORDER) expect(INDEX_GROUP_LABEL[t]).toBeTruthy();
	});
});

describe('describe_cell', () => {
	// As the popup renders it: HTML collapses runs of whitespace.
	const text = (s: string) => s.replace(/\s+/g, ' ');
	const distance = { type: AccessibilityIndexType.MINIMUM_DISTANCE, size: 0.5, distance: 5 };
	const perPerson = { type: AccessibilityIndexType.PER_PERSON, size: 0.5, distance: 30 };
	const exposure = { type: AccessibilityIndexType.EXPOSURE, size: 0.01, distance: 5 };

	it('reads a distance out in minutes, and a park inside the cell as such', () => {
		expect(text(describe_cell(7.26, distance, 5))).toContain('about <b>7.3 min</b> away');
		expect(text(describe_cell(0, distance, 5))).toContain('is within the cell');
	});

	it('says whether the cell meets the target, in the direction the type reads', () => {
		expect(text(describe_cell(4, distance, 5, 'WHO'))).toContain('Meets the WHO target.');
		expect(text(describe_cell(7.26, distance, 5))).toContain(
			'Misses the target: 7.3 min &gt; 5 min.'
		);
		expect(text(describe_cell(12, perPerson, 9))).toContain('Meets the target.');
		expect(text(describe_cell(0.2, exposure, 0.5))).toContain('0.2 ha &lt; 0.5 ha');
	});

	it('rounds large areas to whole numbers', () => {
		expect(text(describe_cell(8106.98, perPerson, 9))).toContain(
			'<b>8,107 m²</b> of green per resident'
		);
	});

	it('escapes the index name, which comes from the API', () => {
		expect(text(describe_cell(1, distance, 5, '<b>x</b>'))).toContain(
			'the &lt;b&gt;x&lt;/b&gt; target'
		);
	});
});

describe('green_type_label', () => {
	it('reads an OpenStreetMap value the way people write it', () => {
		expect(green_type_label(3)).toBe('Recreation ground');
		expect(green_type_label(9)).toBe('Forest');
	});

	it('is empty for an id it does not know', () => {
		expect(green_type_label(42)).toBe('');
	});
});
