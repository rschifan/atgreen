import { describe, expect, it } from 'vitest';
import { AccessibilityIndexType, TargetStoreImpl, UnitType } from './types';

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
		expect(store.getTarget('WHO')?.index.unit).toBe(UnitType.MINUTES);
		expect(store.getTarget('IPP')?.index.unit).toBe(UnitType.SQUARE_METERS);
		expect(store.getTarget('ESA')?.index.unit).toBe(UnitType.HECTARS);
	});

	it('resolves a band from an index name', () => {
		expect(store.getBand('WHO')).toBe(4);
		expect(store.getBand('ESA')).toBe(32);
	});

	it('returns undefined for an unknown index rather than throwing', () => {
		expect(store.getBand('NOPE')).toBeUndefined();
		expect(store.getTarget('NOPE')).toBeUndefined();
	});

	it('resolves an index back from its band', () => {
		expect(store.getIndexbyBand(4)?.name).toBe('WHO');
		expect(store.getIndexbyBand(32)?.name).toBe('ESA');
		expect(store.getIndexbyBand(999)).toBeUndefined();
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
