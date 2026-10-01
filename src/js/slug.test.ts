import { describe, expect, it } from 'vitest';
import {
	city_label,
	city_matches,
	find_city_by_param,
	safe_decode,
	to_city_path,
	to_slug
} from './slug';

const feature = (name: string) => ({ properties: { name } });

describe('safe_decode', () => {
	it('decodes ordinary escapes', () => {
		expect(safe_decode('W%C3%BCrzburg')).toBe('Würzburg');
		expect(safe_decode('Turin')).toBe('Turin');
	});

	// A lone % is a legal URL character but not a legal escape. The not-found
	// notice interpolates this straight into the page, so a throw here is a
	// crashed page where a "no such city" message belongs.
	it('returns the input rather than throwing on a malformed escape', () => {
		expect(() => decodeURIComponent('%')).toThrow();
		expect(safe_decode('%')).toBe('%');
		expect(safe_decode('%zz')).toBe('%zz');
		expect(safe_decode('100%')).toBe('100%');
	});
});

describe('to_city_path', () => {
	it('leaves plain names alone', () => {
		expect(to_city_path('Turin')).toBe('Turin');
		expect(to_city_path('Los_Angeles')).toBe('Los_Angeles');
	});

	it('percent-encodes what a path segment cannot carry', () => {
		expect(to_city_path('Würzburg')).toBe('W%C3%BCrzburg');
		expect(to_city_path('A_Coruña')).toBe('A_Coru%C3%B1a');
	});

	it('round-trips through the resolver', () => {
		const features = [feature('Los_Ángeles'), feature('Los_Angeles')];
		for (const f of features) {
			expect(find_city_by_param(features, to_city_path(f.properties.name))).toBe(f);
		}
	});
});

describe('find_city_by_param', () => {
	const features = [feature('Turin'), feature('Würzburg'), feature('A_Coruña')];

	it('finds a city by its exact encoded name', () => {
		expect(find_city_by_param(features, 'W%C3%BCrzburg')?.properties.name).toBe('Würzburg');
	});

	it('accepts a differently-cased name', () => {
		expect(find_city_by_param(features, 'turin')?.properties.name).toBe('Turin');
		expect(find_city_by_param(features, 'TURIN')?.properties.name).toBe('Turin');
	});

	it('accepts a hand-typed ASCII slug', () => {
		expect(find_city_by_param(features, 'wurzburg')?.properties.name).toBe('Würzburg');
		expect(find_city_by_param(features, 'a-coruna')?.properties.name).toBe('A_Coruña');
	});

	// The reason links are built from the name and not a slug: these two differ
	// only by an accent, and the real dataset contains three such pairs.
	it('keeps accent-differing names distinct when given the exact name', () => {
		const pair = [feature('Los_Angeles'), feature('Los_Ángeles')];
		expect(find_city_by_param(pair, 'Los_Angeles')?.properties.name).toBe('Los_Angeles');
		expect(find_city_by_param(pair, 'Los_%C3%81ngeles')?.properties.name).toBe('Los_Ángeles');
	});

	it('returns undefined rather than throwing on junk', () => {
		expect(find_city_by_param(features, 'atlantis')).toBeUndefined();
		expect(find_city_by_param([], 'turin')).toBeUndefined();
		expect(find_city_by_param(undefined as unknown as [], 'turin')).toBeUndefined();
		expect(find_city_by_param(features, '')).toBeUndefined();
		// A lone % is not a valid escape; decodeURIComponent throws on it.
		expect(() => find_city_by_param(features, '%')).not.toThrow();
	});

	// A name with no ASCII form at all still resolves, because step 1 never
	// reduces it. Slugging alone would have made this city unreachable.
	it('resolves a name that has no ASCII reduction', () => {
		const fa = [feature('بوکان')];
		expect(to_slug('بوکان')).toBe('');
		expect(find_city_by_param(fa, to_city_path('بوکان'))?.properties.name).toBe('بوکان');
	});
});

describe('to_slug', () => {
	it('folds combining accents', () => {
		expect(to_slug('Würzburg')).toBe('wurzburg');
		expect(to_slug('Genève')).toBe('geneve');
	});

	// Stroked and ligature letters have no NFD form, so without the lookup table
	// they would be deleted outright rather than transliterated.
	it('transliterates letters NFD cannot decompose', () => {
		expect(to_slug('Łódź')).toBe('lodz');
		expect(to_slug('Køge')).toBe('koge');
		expect(to_slug('Straße')).toBe('strasse');
	});

	it('collapses punctuation and trims', () => {
		expect(to_slug("Reggio nell'Emilia")).toBe('reggio-nell-emilia');
		expect(to_slug('Los_Angeles')).toBe('los-angeles');
		expect(to_slug('  Bad   Ems  ')).toBe('bad-ems');
	});

	it('returns empty for input with no ASCII content', () => {
		expect(to_slug('')).toBe('');
		expect(to_slug(undefined as unknown as string)).toBe('');
		expect(to_slug('---')).toBe('');
	});
});

describe('city_label', () => {
	it('shows underscores as spaces, and leaves everything else alone', () => {
		expect(city_label('Newcastle_upon_Tyne')).toBe('Newcastle upon Tyne');
		expect(city_label('Bolzano_-_Bozen')).toBe('Bolzano - Bozen');
		expect(city_label('Alacant__Alicante')).toBe('Alacant / Alicante');
		expect(city_label('Turin')).toBe('Turin');
		expect(city_label('بوكان')).toBe('بوكان');
	});
});

describe('city_matches', () => {
	it('ignores case, accents and spaces-vs-underscores', () => {
		expect(city_matches('New_York', 'new york')).toBe(true);
		expect(city_matches('São_Paulo', 'sao paulo')).toBe(true);
		expect(city_matches('São_Paulo', 'São Paulo')).toBe(true);
		expect(city_matches('Łódź', 'lodz')).toBe(true);
		expect(city_matches('Turin', 'TUR')).toBe(true);
	});

	it('matches a non-Latin name in its own script', () => {
		expect(city_matches('بوكان', 'بوك')).toBe(true);
	});

	it('does not match an empty query or a different city', () => {
		expect(city_matches('Turin', '')).toBe(false);
		expect(city_matches('Turin', '   ')).toBe(false);
		expect(city_matches('Turin', 'milan')).toBe(false);
	});
});
