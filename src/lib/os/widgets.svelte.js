// Desktop widgets: built-ins plus widgets the user imports.
//
// Position is stored as a distance from the top-right corner, so a widget keeps its place when the
// window is resized. Imported widgets are plain HTML that runs in a sandboxed iframe (see
// Widgets.svelte), so a widget can draw and run scripts but can't touch Hopium or the network.
import { loadSetting, saveSetting, onSettingChange } from '$lib/utils/localspace.js';

export const BUILTIN = [
	{ id: 'clock', name: 'Clock', w: 168, h: 168 },
	{ id: 'calendar', name: 'Calendar', w: 232, h: 248 },
	{ id: 'notes', name: 'Notes', w: 232, h: 176 },
	{ id: 'spotify', name: 'Now Playing', w: 232, h: 104 },
	{ id: 'system', name: 'System', w: 232, h: 104 }
];

const GAP = 14;
const TOP = 46;
const DEFAULT_ON = ['clock', 'calendar'];

function builtinItems() {
	let y = TOP;
	const out = {};
	for (const w of BUILTIN) {
		out[w.id] = { on: DEFAULT_ON.includes(w.id), x: 16, y };
		y += w.h + GAP;
	}
	return out;
}

export const widgets = $state({
	show: true,
	/** Edit mode (gallery tray + remove badges). Never saved. */
	editing: false,
	items: builtinItems(),
	/** Imported widgets: { id, name, w, h, html } */
	custom: []
});

/** Built-in and imported widgets, in one list. */
export const allWidgets = () => [...BUILTIN, ...widgets.custom.map((c) => ({ id: c.id, name: c.name, w: c.w, h: c.h, custom: true, html: c.html }))];

function apply(value) {
	if (!value || typeof value !== 'object') return;
	if (typeof value.show === 'boolean') widgets.show = value.show;
	if (Array.isArray(value.custom)) widgets.custom = value.custom;
	if (value.items) {
		for (const [id, it] of Object.entries(value.items)) {
			widgets.items[id] = { ...(widgets.items[id] ?? { on: true, x: 16, y: TOP }), ...it };
		}
	}
}

let started = false;
export function initWidgets() {
	if (started) return () => {};
	started = true;
	loadSetting('widgets', null).then(apply).catch(() => {});
	const off = onSettingChange('widgets', apply);
	return () => {
		started = false;
		off();
	};
}

const persist = () => {
	const { show, items, custom } = $state.snapshot(widgets);
	saveSetting('widgets', { show, items, custom });
};
export const commitWidgets = persist;

export function setShow(value) {
	widgets.show = value;
	persist();
}
export function setEditing(value) {
	widgets.editing = value;
	if (value) widgets.show = true;
}
export function toggleWidget(id) {
	if (!widgets.items[id]) widgets.items[id] = { on: false, x: 16, y: TOP };
	widgets.items[id].on = !widgets.items[id].on;
	persist();
}
export function moveWidget(id, x, y) {
	widgets.items[id].x = Math.round(x);
	widgets.items[id].y = Math.round(y);
}
export function resetWidgets() {
	widgets.items = { ...builtinItems(), ...Object.fromEntries(widgets.custom.map((c, i) => [c.id, { on: true, x: 16 + (i + 1) * 24, y: TOP + (i + 1) * 24 }])) };
	widgets.show = true;
	persist();
}

/* ---------- importing ---------- */
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Math.round(n) || lo));

/** Turn a dropped/pasted file into a widget. Accepts a bare HTML file, or JSON { name, w, h, html }.
 *  An HTML file may say how big it wants to be: <meta name="widget-size" content="240x160">. */
export function parseWidget(text, filename = '') {
	const raw = String(text ?? '').trim();
	if (!raw) throw new Error('That file is empty.');
	let name = filename.replace(/\.[^.]+$/, '') || 'Widget';
	let w = 232;
	let h = 168;
	let html = raw;
	if (raw.startsWith('{')) {
		let j;
		try {
			j = JSON.parse(raw);
		} catch {
			throw new Error('That JSON file isn’t valid.');
		}
		if (typeof j.html !== 'string' || !j.html.trim()) throw new Error('A widget JSON file needs an "html" field.');
		html = j.html;
		name = j.name || name;
		w = j.w ?? j.width ?? w;
		h = j.h ?? j.height ?? h;
	} else {
		const title = raw.match(/<title[^>]*>([^<]{1,60})<\/title>/i)?.[1];
		const meta = raw.match(/<meta[^>]+name=["']widget-name["'][^>]+content=["']([^"']{1,60})["']/i)?.[1];
		name = meta || title || name;
		const size = raw.match(/<meta[^>]+name=["']widget-size["'][^>]+content=["'](\d{2,3})\s*[x×]\s*(\d{2,3})["']/i);
		if (size) [w, h] = [Number(size[1]), Number(size[2])];
	}
	if (html.length > 400_000) throw new Error('That widget is too big (400 KB max).');
	return { name: String(name).trim().slice(0, 40) || 'Widget', w: clamp(w, 120, 520), h: clamp(h, 80, 520), html };
}

export function importWidget(text, filename) {
	const parsed = parseWidget(text, filename);
	const id = `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
	const n = widgets.custom.length;
	widgets.custom.push({ id, ...parsed });
	widgets.items[id] = { on: true, x: 40 + n * 24, y: TOP + 24 + n * 24 };
	widgets.show = true;
	persist();
	return parsed;
}

export function removeCustomWidget(id) {
	widgets.custom = widgets.custom.filter((c) => c.id !== id);
	delete widgets.items[id];
	persist();
}

/** The document an imported widget runs in. No network, no parent access. */
export function widgetDoc(html) {
	const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:">`;
	const base = `<style>html,body{margin:0;height:100%;overflow:hidden;background:transparent;color:#fff;font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif}</style>`;
	return `<!doctype html><html><head><meta charset="utf-8">${csp}${base}</head><body>${html}</body></html>`;
}
