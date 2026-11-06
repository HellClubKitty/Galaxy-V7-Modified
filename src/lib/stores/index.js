// Cross-component signals for the in-page browser (/slate). The OS desktop uses $lib/os/wm.svelte.js.
import { writable } from 'svelte/store';
export const activeTab = writable(/** @type {number | null} */ (null));
export const deleteTab = writable(/** @type {number | null} */ (null));
export const slotsDragged = writable(/** @type {number | null} */ (null));
export const draggedOverLeft = writable(/** @type {number | null} */ (null));
export const draggedOverRight = writable(/** @type {number | null} */ (null));
export const isTabDragging = writable(false);
export const reloadSignal = writable(/** @type {number | null} */ (null));
export const goBackSignal = writable(/** @type {number | null} */ (null));
export const goForwardSignal = writable(/** @type {number | null} */ (null));
