import { describe, expect, it } from 'vitest';
import {
	create_empty_geojson,
	create_geojson,
	escape_html,
	get_green_types_code,
	html
} from './utils';

describe('get_green_types_code', () => {
	// The codes are positional: the RPCs take this number, not the list.
	it('maps each supported combination to its code', () => {
		expect(get_green_types_code(['forests', 'grass', 'parks'] as never)).toBe(0);
		expect(get_green_types_code(['forests', 'parks'] as never)).toBe(1);
		expect(get_green_types_code(['grass', 'parks'] as never)).toBe(2);
		expect(get_green_types_code(['parks'] as never)).toBe(3);
		expect(get_green_types_code(['forests', 'grass'] as never)).toBe(4);
		expect(get_green_types_code(['forests'] as never)).toBe(5);
		expect(get_green_types_code(['grass'] as never)).toBe(6);
	});

	it('depends on the order of the input, not its contents', () => {
		// 'parks,forests' is the same selection as 'forests,parks' but matches no case,
		// so it silently falls through to 0 = all three types.
		expect(get_green_types_code(['parks', 'forests'] as never)).toBe(0);
	});

	it('returns undefined when given no list at all', () => {
		expect(get_green_types_code(undefined as never)).toBeUndefined();
	});

	// Known defect: [] is truthy, joins to '', matches no case and falls through to the
	// default 0 - which is the code for *all three* green types. Deselecting everything
	// therefore asks for everything. The UI should reject an empty selection instead.
	it('does not treat an empty selection as "all types"', () => {
		expect(get_green_types_code([] as never)).not.toBe(0);
	});
});

describe('geojson helpers', () => {
	it('creates a well-formed empty FeatureCollection', () => {
		expect(create_empty_geojson()).toEqual({ type: 'FeatureCollection', features: [] });
	});

	it('wraps features in a FeatureCollection', () => {
		const features = [{ type: 'Feature', geometry: null, properties: {} }];
		expect(create_geojson(features as never)).toEqual({
			type: 'FeatureCollection',
			features
		});
	});

	it('returns a fresh object each time, so callers cannot alias one empty collection', () => {
		const a = create_empty_geojson();
		const b = create_empty_geojson();
		expect(a).not.toBe(b);
	});
});

describe('escape_html / html', () => {
	it('escapes the characters that can break out of markup', () => {
		expect(escape_html('<script>')).toBe('&lt;script&gt;');
		expect(escape_html('a & b')).toBe('a &amp; b');
		expect(escape_html('say "hi"')).toBe('say &quot;hi&quot;');
		expect(escape_html("it's")).toBe('it&#39;s');
	});

	it('leaves ordinary text alone', () => {
		expect(escape_html('Parco Dora')).toBe('Parco Dora');
		expect(escape_html('Giardino Sambuy')).toBe('Giardino Sambuy');
	});

	it('survives null, undefined and numbers', () => {
		expect(escape_html(null)).toBe('');
		expect(escape_html(undefined)).toBe('');
		expect(escape_html(42)).toBe('42');
	});

	// The reason this exists: these popup strings go to Mapbox's setHTML, which
	// assigns to innerHTML, and osm_name is OpenStreetMap free text — anyone with
	// an account can rename a park. The live CSP carries script-src 'unsafe-inline',
	// so an injected handler would execute.
	it('neutralises an injected handler in a place name', () => {
		const name = '<img src=x onerror="alert(1)">';
		const out = html`<span class="popup-ga-name">${name}</span>`;
		expect(out).not.toContain('<img');
		expect(out).not.toContain('onerror="');
		expect(out).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
	});

	it('keeps the literal markup around the interpolation intact', () => {
		const out = html`<div class="popup-container">${'Parco Dora'}</div>`;
		expect(out).toBe('<div class="popup-container">Parco Dora</div>');
	});

	// A tagged template rather than escaping one known field, so a field added
	// later is escaped without anyone having to remember.
	it('escapes every interpolation, not just the first', () => {
		const out = html`<a>${'<b>'}</a><c>${'<d>'}</c>`;
		expect(out).toBe('<a>&lt;b&gt;</a><c>&lt;d&gt;</c>');
	});
});
