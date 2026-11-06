// Extensions: small add-ons that can be switched on and off.
//
// Built-in extensions are written into Hopium (see Extensions.svelte). Imported .js add-ons run
// in a restricted iframe. JSON manifests may additionally declare website content scripts; those
// are explicitly user-trusted code and run in the matched proxied page so they can modify its DOM.
import { MAX_EXTENSION_BYTES, createHopiumExtensionApi, sandboxExtensionCode } from '$lib/lethe/browser-extensions.js';
import { loadSetting, saveSetting, onSettingChange } from '$lib/utils/localspace.js';

/** @typedef {{ id: string, name: string, description: string, code: string, contentScripts: { matches: string[], js: string, css: string }[] }} UserExtension */

export const BUILTIN_EXT = [
	{ id: 'focus-timer', name: 'Focus Timer', description: 'A 25-minute focus session in the menu bar. Click to start or pause.', builtin: true },
	{ id: 'window-tiler', name: 'Window Tiler', description: 'Ctrl+Alt with the arrow keys snaps the front window: left, right, zoom, minimise.', builtin: true },
	{ id: 'night-shade', name: 'Night Shade', description: 'A warm, dimmed screen for the evening. Toggle it from the menu bar.', builtin: true },
	{ id: 'quick-launch', name: 'Quick Launch', description: 'Alt+1 to Alt+9 opens the apps in your dock.', builtin: true }
];

const DEFAULT_ON = { 'focus-timer': true, 'window-tiler': true, 'night-shade': false, 'quick-launch': false };

export const ext = $state({
	enabled: { ...DEFAULT_ON },
	/** Imported: { id, name, description, code } */
	user: /** @type {UserExtension[]} */ ([])
});

/** Items extensions put in the menu bar. The Extensions host fills this in. */
export const extBar = $state({ items: /** @type {any[]} */ ([]) });

export const extList = () => [...BUILTIN_EXT, ...ext.user.map((u) => ({ ...u, builtin: false }))];
export const isOn = (id) => !!ext.enabled[id];

function apply(v) {
	if (!v || typeof v !== 'object') return;
	if (v.enabled) ext.enabled = { ...DEFAULT_ON, ...v.enabled };
	if (Array.isArray(v.user)) ext.user = v.user;
}

let started = false;
export function initExtensions() {
	if (started) return () => {};
	started = true;
	loadSetting('extensions', null).then(apply).catch(() => {});
	const off = onSettingChange('extensions', apply);
	return () => {
		started = false;
		off();
	};
}

const persist = () => {
	const { enabled, user } = $state.snapshot(ext);
	saveSetting('extensions', { enabled, user });
};

export function toggleExt(id) {
	ext.enabled[id] = !ext.enabled[id];
	persist();
}

export function removeExt(id) {
	ext.user = ext.user.filter((u) => u.id !== id);
	delete ext.enabled[id];
	persist();
}

/** Accept a .js add-on or a JSON manifest with optional website content scripts. */
export function parseExtension(text, filename = '') {
	const raw = String(text ?? '').trim();
	if (!raw) throw new Error('That file is empty.');
	let name = filename.replace(/\.[^.]+$/, '') || 'Extension';
	let description = '';
	let code = raw;
	/** @type {UserExtension['contentScripts']} */
	let contentScripts = [];

	if (raw.startsWith('{')) {
		let manifest;
		try {
			manifest = JSON.parse(raw);
		} catch {
			throw new Error('That JSON file isn’t valid.');
		}
		if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
			throw new Error('An extension manifest must be a JSON object.');
		}
		name = manifest.name || name;
		description = manifest.description || '';
		code = typeof manifest.code === 'string' ? manifest.code : '';

		if (manifest.contentScripts !== undefined && !Array.isArray(manifest.contentScripts)) {
			throw new Error('The contentScripts field must be an array.');
		}
		const definitions = Array.isArray(manifest.contentScripts)
			? manifest.contentScripts
			: manifest.contentScript || manifest.css
				? [{ js: manifest.contentScript ?? '', css: manifest.css ?? '', matches: manifest.matches }]
				: [];
		if (definitions.length > 20) throw new Error('An extension can define at most 20 content scripts.');
		contentScripts = definitions.map((entry, index) => {
			if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
				throw new Error(`Content script ${index + 1} must be an object.`);
			}
			const js = typeof entry.js === 'string' ? entry.js : '';
			const css = typeof entry.css === 'string' ? entry.css : '';
			if (!js.trim() && !css.trim()) throw new Error(`Content script ${index + 1} needs a js or css field.`);
			const matches = entry.matches ?? manifest.matches ?? ['<all_urls>'];
			if (!Array.isArray(matches) || matches.length < 1 || matches.length > 50 || matches.some((value) => typeof value !== 'string' || !value.trim())) {
				throw new Error(`Content script ${index + 1} needs 1–50 valid match patterns.`);
			}
			if (matches.some((value) => value !== '<all_urls>' && !/^(\*|https?):\/\/([^/]+)\/.*$/.test(value.trim()))) {
				throw new Error('Match patterns must look like https://example.com/*, *://*.example.com/*, or <all_urls>.');
			}
			return { matches: matches.slice(0, 50).map((value) => value.trim()), js, css };
		});
	} else {
		name = raw.match(/^\s*\/\/\s*@name\s+(.+)$/m)?.[1] ?? name;
		description = raw.match(/^\s*\/\/\s*@description\s+(.+)$/m)?.[1] ?? '';
	}

	if (code.length > MAX_EXTENSION_BYTES || contentScripts.some((entry) => entry.js.length > MAX_EXTENSION_BYTES || entry.css.length > MAX_EXTENSION_BYTES)) {
		throw new Error(`That extension is too big (${Math.round(MAX_EXTENSION_BYTES / 1024)} KB per script or stylesheet max).`);
	}
	if (!code.trim() && contentScripts.length === 0) {
		throw new Error('An extension needs a code field or at least one content script.');
	}
	return {
		name: String(name).trim().slice(0, 40) || 'Extension',
		description: String(description).trim().slice(0, 140),
		code,
		contentScripts
	};
}

export function importExtension(text, filename) {
	const parsed = parseExtension(text, filename);
	const id = `ext-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	ext.user.push({ id, ...parsed });
	ext.enabled[id] = true;
	persist();
	return parsed;
}

/** The page an imported extension runs in. `hopium` is the whole API. */
export function extensionDoc(id, code) {
	const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'">`;
	const sdk = `
${createHopiumExtensionApi(id)}
try {
${sandboxExtensionCode(code)}
} catch (err) { __post({ type: 'toast', text: 'Extension error: ' + (err && err.message || err) }); }
`;
	return `<!doctype html><html><head><meta charset="utf-8">${csp}</head><body><script>${sdk.replace(/<\/script/gi, '<\\/script')}<\/script></body></html>`;
}
