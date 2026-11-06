import { redirect } from '@sveltejs/kit';

// There is no mode chooser any more: the desktop is the front door.
export function load() {
	redirect(307, '/os');
}
