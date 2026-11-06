// Cross-component signals for the in-page browser (/slate). The OS desktop uses $lib/os/wm.svelte.js.
import { writable } from 'svelte/store';
export const activeTab = writable(null);
export const deleteTab = writable(null);
export const slotsDragged = writable(null);
export const draggedOverLeft = writable(null);
export const draggedOverRight = writable(null);
export const isTabDragging = writable(null);
export const reloadSignal = writable(null);
export const goBackSignal = writable(null);
export const goForwardSignal = writable(null);
