import { describe, expect, it } from 'vitest';
import { findCityByParam, findSlugCollisions, safeDecode, toCityPath, toSlug } from './slug';

const feature = (name: string) => ({ properties: { name } });

describe('safeDecode', () => {
	it('decodes ordinary escapes', () => {
		expect(safeDecode('W%C3%BCrzburg')).toBe('Würzburg');
		expect(safeDecode('Turin')).toBe('Turin');
	});

	// A lone % is a legal URL character but not a legal escape. The not-found
	// notice interpolates this straight into the page, so a throw here is a
	// crashed page where a "no such city" message belongs.
	it('returns the input rather than throwing on a malformed escape', () => {
		expect(() => decodeURIComponent('%')).toThrow();
		expect(safeDecode('%')).toBe('%');
		expect(safeDecode('%zz')).toBe('%zz');
		expect(safeDecode('100%')).toBe('100%');
	});
});

describe('toCityPath', () => {
	it('leaves plain names alone', () => {
		expect(toCityPath('Turin')).toBe('Turin');
		expect(toCityPath('Los_Angeles')).toBe('Los_Angeles');
	});

	it('percent-encodes what a path segment cannot carry', () => {
		expect(toCityPath('Würzburg')).toBe('W%C3%BCrzburg');
		expect(toCityPath('A_Coruña')).toBe('A_Coru%C3%B1a');
	});

	it('round-trips through the resolver', () => {
		const features = [feature('Los_Ángeles'), feature('Los_Angeles')];
		for (const f of features) {
			expect(findCityByParam(features, toCityPath(f.properties.name))).toBe(f);
		}
	});
});

describe('findCityByParam', () => {
	const features = [feature('Turin'), feature('Würzburg'), feature('A_Coruña')];

	it('finds a city by its exact encoded name', () => {
		expect(findCityByParam(features, 'W%C3%BCrzburg')?.properties.name).toBe('Würzburg');
	});

	it('accepts a differently-cased name', () => {
		expect(findCityByParam(features, 'turin')?.properties.name).toBe('Turin');
		expect(findCityByParam(features, 'TURIN')?.properties.name).toBe('Turin');
	});

	it('accepts a hand-typed ASCII slug', () => {
		expect(findCityByParam(features, 'wurzburg')?.properties.name).toBe('Würzburg');
		expect(findCityByParam(features, 'a-coruna')?.properties.name).toBe('A_Coruña');
	});

	// The reason links are built from the name and not a slug: these two differ
	// only by an accent, and the real dataset contains three such pairs.
	it('keeps accent-differing names distinct when given the exact name', () => {
		const pair = [feature('Los_Angeles'), feature('Los_Ángeles')];
		expect(findCityByParam(pair, 'Los_Angeles')?.properties.name).toBe('Los_Angeles');
		expect(findCityByParam(pair, 'Los_%C3%81ngeles')?.properties.name).toBe('Los_Ángeles');
	});

	it('returns undefined rather than throwing on junk', () => {
		expect(findCityByParam(features, 'atlantis')).toBeUndefined();
		expect(findCityByParam([], 'turin')).toBeUndefined();
		expect(findCityByParam(undefined as unknown as [], 'turin')).toBeUndefined();
		expect(findCityByParam(features, '')).toBeUndefined();
		// A lone % is not a valid escape; decodeURIComponent throws on it.
		expect(() => findCityByParam(features, '%')).not.toThrow();
	});

	// A name with no ASCII form at all still resolves, because step 1 never
	// reduces it. Slugging alone would have made this city unreachable.
	it('resolves a name that has no ASCII reduction', () => {
		const fa = [feature('بوکان')];
		expect(toSlug('بوکان')).toBe('');
		expect(findCityByParam(fa, toCityPath('بوکان'))?.properties.name).toBe('بوکان');
	});
});

describe('toSlug', () => {
	it('folds combining accents', () => {
		expect(toSlug('Würzburg')).toBe('wurzburg');
		expect(toSlug('Genève')).toBe('geneve');
	});

	// Stroked and ligature letters have no NFD form, so without the lookup table
	// they would be deleted outright rather than transliterated.
	it('transliterates letters NFD cannot decompose', () => {
		expect(toSlug('Łódź')).toBe('lodz');
		expect(toSlug('Køge')).toBe('koge');
		expect(toSlug('Straße')).toBe('strasse');
	});

	it('collapses punctuation and trims', () => {
		expect(toSlug("Reggio nell'Emilia")).toBe('reggio-nell-emilia');
		expect(toSlug('Los_Angeles')).toBe('los-angeles');
		expect(toSlug('  Bad   Ems  ')).toBe('bad-ems');
	});

	it('returns empty for input with no ASCII content', () => {
		expect(toSlug('')).toBe('');
		expect(toSlug(undefined as unknown as string)).toBe('');
		expect(toSlug('---')).toBe('');
	});
});

describe('findSlugCollisions', () => {
	it('reports nothing when every name is distinct', () => {
		expect(findSlugCollisions([feature('Turin'), feature('Milan')])).toEqual({});
	});

	it('reports two names that fold to the same slug', () => {
		expect(findSlugCollisions([feature('Córdoba'), feature('Cordoba')])).toEqual({
			cordoba: ['Cordoba', 'Córdoba']
		});
	});

	it('does not report the same city listed twice', () => {
		expect(findSlugCollisions([feature('Turin'), feature('Turin')])).toEqual({});
	});
});
