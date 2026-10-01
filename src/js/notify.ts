import { toast } from 'svelte-sonner';
import { city_label } from './slug';

/** An index that came back empty, or a request that failed: said once, in a toast. */
export function toast_no_index(city: string | undefined) {
	toast.error('No index generated', {
		description: `No park with these characteristics found in ${city_label(city ?? '') || 'this city'}.`
	});
}
