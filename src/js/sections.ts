/**
 * The city sections, in tab order, and the route each one lives at. The header
 * menu and the section bar both build their links from here.
 */
export const SECTIONS = ['measure', 'compare', 'create', 'draw', 'explore'] as const;
export type Section = (typeof SECTIONS)[number];

// Route ids, not built strings: `resolve` applies any base path and is typed,
// so renaming a section route breaks the build rather than the links.
export const SECTION_ROUTES = {
	measure: '/[city]/measure',
	compare: '/[city]/compare',
	create: '/[city]/create',
	draw: '/[city]/draw',
	explore: '/[city]/explore'
} as const;

export const section_title = (s: Section) => s[0].toUpperCase() + s.slice(1);

/** The section a path shows; Measure when it shows none. */
export const section_of = (pathname: string): Section =>
	SECTIONS.find((s) => pathname.endsWith('/' + s)) ?? 'measure';
