import { redirect } from '@sveltejs/kit';

/** `/Turin` has no view of its own; Measure is the one to open on. */
export function load({ params }) {
	redirect(307, `/${encodeURIComponent(params.city)}/measure`);
}
