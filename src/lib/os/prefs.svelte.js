// Desktop customisation. One reactive object, shared by the desktop and the Settings pane (which
// runs in an iframe, so changes travel through the settings BroadcastChannel).
import { loadSetting, saveSetting, onSettingChange } from '$lib/utils/localspace.js';

export const defaults = {
	dockPos: 'bottom', // bottom | left | right
	dockSize: 52,
	magnify: true,
	magnifyAmount: 1.7,
	dockAutoHide: false,
	iconStyle: 'plain', // plain (the original glyphs) | tile
	accent: '#0a84ff',
	menuBar: 'glass', // glass | solid | hidden
	clock24: false,
	clockDate: true,
	trafficLights: 'color', // color | mono
	windowRadius: 12,
	windowShadow: 'soft', // none | soft | deep
	desktopIcons: false,
	lockScreen: true,
	animations: true,
	// Look & feel
	glassBlur: 28, // px, backdrop blur on the dock, menu bar and panels
	glassStrength: 0.16, // 0.04 .. 0.4, how milky the glass is
	wallpaperFx: true, // slow drift, vignette and a soft shade under the menu bar
	// Startup screen
	bootStyle: 'auto', // auto (matches your computer) | mac | windows | off
	// Spotify
	spotifyHud: true, // menu bar chip + now-playing panel
	spotifyBanner: true // slide-in banner when the track changes
};

export const accents = [
	['Blue', '#0a84ff'],
	['Purple', '#a550d4'],
	['Pink', '#ff4f8b'],
	['Red', '#ff453a'],
	['Orange', '#ff9f0a'],
	['Yellow', '#e5b800'],
	['Green', '#30c452'],
	['Graphite', '#8e8e93']
];

export const prefs = $state({ ...defaults });

function apply(value) {
	if (value && typeof value === 'object') Object.assign(prefs, defaults, value);
}

let started = false;
/** Load saved prefs and follow changes made elsewhere. Returns an unsubscribe function. */
export function initPrefs() {
	if (started) return () => {};
	started = true;
	loadSetting('desktop', null)
		.then(apply)
		.catch(() => {});
	const off = onSettingChange('desktop', apply);
	return () => {
		started = false;
		off();
	};
}

export function setPref(key, value) {
	prefs[key] = value;
	saveSetting('desktop', $state.snapshot(prefs));
}

export function resetPrefs() {
	Object.assign(prefs, defaults);
	saveSetting('desktop', { ...defaults });
}
