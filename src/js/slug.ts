/**
 * City names in URLs.
 *
 * The API identifies a city by its display name, already underscore-separated:
 * "Turin", "A_Coruna", "Los_Angeles", and non-Latin names too. That name is the
 * only stable id we have, so it is what goes in the path -- percent-encoded,
 * which browsers display decoded. The URL reads well and round-trips exactly.
 *
 * Folding to an ASCII slug was the first design and it does not survive the
 * real data. Of the 1,046 cities the API returns, three pairs fold together --
 * Cordoba/Cordoba, Los_Angeles/Los_Angeles, San_Jose/San_Jose, each pair
 * differing only by an accent -- which would leave one of each unreachable, and
 * one Perso-Arabic name folds to nothing at all.
 *
 * Slugs are still accepted on the way in, so a hand-typed `/turin/measure`
 * works; they are simply never generated.
 */

/** The shape this module needs from a city feature: just its name. */
export type NamedFeature = { properties?: { name?: string } };

/** The path segment for a city. Percent-encoded; browsers show it decoded. */
export function toCityPath(name: string): string {
	return encodeURIComponent(String(name ?? ''));
}

/**
 * A URL-safe ASCII reduction, used only to match loosely-typed input.
 * Not used to build links -- see the note above.
 */
export function toSlug(name: string): string {
	return String(name ?? '')
		.replace(/[łŁøØđĐæÆœŒßþÞðÐ]/g, (c) => STROKED[c] ?? c)
		.normalize('NFD') // split an accented letter into base + combining mark...
		.replace(/[̀-ͯ]/g, '') // ...then drop the mark
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Letters whose diacritic is a stroke or a ligature rather than a combining
 * mark, so NFD leaves them whole and the [^a-z0-9] pass would delete them.
 * Without these, Lodz (stroked L) reduces to "odz".
 */
const STROKED: Record<string, string> = {
	ł: 'l',
	Ł: 'L',
	ø: 'o',
	Ø: 'O',
	đ: 'd',
	Đ: 'D',
	æ: 'ae',
	Æ: 'AE',
	œ: 'oe',
	Œ: 'OE',
	ß: 'ss',
	þ: 'th',
	Þ: 'TH',
	ð: 'd',
	Ð: 'D'
};

/**
 * Resolve a path segment to a city feature, most precise match first:
 *
 *   1. the exact name          -- keeps the three accent-differing pairs distinct
 *   2. the same name, any case -- `/turin` finds "Turin"
 *   3. an ASCII slug           -- `/a-coruna` finds "A_Coruna" with its accent
 *
 * Only step 3 can be ambiguous, and only for those three pairs; links the app
 * generates always hit step 1, so ambiguity needs a hand-typed URL.
 */
export function findCityByParam<T extends NamedFeature>(features: T[], param: string) {
	if (!Array.isArray(features) || !param) return undefined;

	let decoded = String(param);
	try {
		decoded = decodeURIComponent(decoded);
	} catch {
		// A malformed %-escape is a bad URL, not a crash: fall through and let
		// the looser matches below have a go at the raw text.
	}

	const name = (f: NamedFeature) => f?.properties?.name;

	const exact = features.find((f) => name(f) === decoded);
	if (exact) return exact;

	const lower = decoded.toLowerCase();
	const insensitive = features.find((f) => String(name(f) ?? '').toLowerCase() === lower);
	if (insensitive) return insensitive;

	const wanted = toSlug(decoded);
	if (!wanted) return undefined;
	return features.find((f) => toSlug(name(f) ?? '') === wanted);
}

/**
 * Every ASCII slug claimed by more than one city name.
 *
 * These cities are all reachable by their exact name, so this is not a fault --
 * it is the evidence for why links are built from the name. The test pins the
 * known set so a future import that adds a pair is noticed here.
 */
export function findSlugCollisions(features: NamedFeature[]): Record<string, string[]> {
	const byslug: Record<string, string[]> = {};
	for (const f of features ?? []) {
		const n = f?.properties?.name;
		if (!n) continue;
		const s = toSlug(n);
		if (!s) continue;
		(byslug[s] ??= []).push(n);
	}
	const clashes: Record<string, string[]> = {};
	for (const [s, names] of Object.entries(byslug)) {
		const distinct = [...new Set(names)];
		if (distinct.length > 1) clashes[s] = distinct.sort();
	}
	return clashes;
}
