// Window manager state for the OS desktop. One reactive object, plain functions to mutate it.
// Geometry is in CSS pixels. Maximised/snapped windows keep their previous geometry in `restore`.
import { browser } from '$app/environment';

export const TOPBAR_H = 28;
export const MIN_W = 360;
export const MIN_H = 240;

export const wm = $state({
	windows: /** @type {any[]} */ ([]),
	activeId: /** @type {string | null} */ (null),
	zTop: 1,
	dragging: false,
	/** Edge-snap hint shown while dragging a window: 'left' | 'right' | 'top' | null */
	snapPreview: /** @type {string | null} */ (null),
	toasts: /** @type {{ id: string, message: string }[]} */ ([]),
	/** Space taken by the menu bar and dock, in px. The page keeps this in sync with the prefs. */
	inset: { top: 28, bottom: 0, left: 0, right: 0 },
	vw: browser ? innerWidth : 1280,
	vh: browser ? innerHeight : 720
});

let seq = 0;
const uid = () => `w${Date.now().toString(36)}${(seq++).toString(36)}`;

export function workArea() {
	const { top, bottom, left, right } = wm.inset;
	return {
		x: left,
		y: top,
		w: Math.max(MIN_W, wm.vw - left - right),
		h: Math.max(MIN_H, wm.vh - top - bottom)
	};
}

const px = (value, total) => {
	const str = String(value);
	return str.endsWith('%') ? (parseFloat(str) / 100) * total : parseFloat(str);
};

export function windowsOf(appId) {
	return wm.windows.filter((w) => w.appId === appId);
}

function clampToWork(win) {
	const area = workArea();
	win.w = Math.min(Math.max(MIN_W, win.w), area.w);
	win.h = Math.min(Math.max(MIN_H, win.h), area.h);
	win.x = Math.min(Math.max(area.x - win.w + 120, win.x), area.x + area.w - 120);
	win.y = Math.min(Math.max(area.y, win.y), area.y + area.h - 40);
}

function create(app, title) {
	const area = workArea();
	const w = Math.min(Math.max(MIN_W, px(app.width ?? '60%', area.w)), area.w);
	const h = Math.min(Math.max(MIN_H, px(app.height ?? '60%', area.h)), area.h);
	// Cascade new windows so they never stack exactly on top of each other.
	const step = (wm.windows.length % 8) * 28;
	const win = {
		id: uid(),
		appId: app.id,
		title,
		icon: app.icon,
		url: app.url,
		x: area.x + Math.round((area.w - w) / 2) + step - 56,
		y: Math.round(area.y + (area.h - h) / 3) + step,
		w,
		h,
		z: ++wm.zTop,
		minimized: false,
		maximized: false,
		snap: null,
		restore: null
	};
	clampToWork(win);
	wm.windows.push(win);
	wm.activeId = win.id;
	return win;
}

/** Dock click behaviour: open, or focus the app's window; a second click on the front window hides it. */
export function launch(app) {
	const open = windowsOf(app.id);
	if (open.length === 0) return create(app, app.name);
	const active = open.find((w) => w.id === wm.activeId);
	if (open.length === 1) {
		const [win] = open;
		if (win.minimized) return focus(win.id);
		if (active) return minimize(win.id);
		return focus(win.id);
	}
	return open;
}

export function openNew(app) {
	const count = windowsOf(app.id).length;
	return create(app, count ? `${app.name} (${count + 1})` : app.name);
}

export function find(id) {
	return wm.windows.find((w) => w.id === id);
}

export function focus(id) {
	const win = find(id);
	if (!win) return;
	win.minimized = false;
	win.z = ++wm.zTop;
	wm.activeId = id;
}

export function minimize(id) {
	const win = find(id);
	if (!win) return;
	win.minimized = true;
	if (wm.activeId === id) wm.activeId = topVisible()?.id ?? null;
}

function topVisible() {
	return wm.windows
		.filter((w) => !w.minimized)
		.sort((a, b) => b.z - a.z)[0];
}

export function close(id) {
	const idx = wm.windows.findIndex((w) => w.id === id);
	if (idx === -1) return;
	wm.windows.splice(idx, 1);
	if (wm.activeId === id) wm.activeId = topVisible()?.id ?? null;
}

export function closeApp(appId) {
	for (const win of windowsOf(appId)) close(win.id);
}

function stash(win) {
	if (!win.maximized && !win.snap) win.restore = { x: win.x, y: win.y, w: win.w, h: win.h };
}

export function toggleMaximize(id) {
	const win = find(id);
	if (!win) return;
	if (win.maximized || win.snap) return restore(id);
	stash(win);
	win.maximized = true;
	focus(id);
}

export function snap(id, side) {
	const win = find(id);
	if (!win) return;
	if (side === 'top') {
		stash(win);
		win.snap = null;
		win.maximized = true;
	} else {
		stash(win);
		win.maximized = false;
		win.snap = side;
	}
	focus(id);
}

/** Leave maximised/snapped state, optionally keeping the pointer anchored on the titlebar. */
export function restore(id, anchor) {
	const win = find(id);
	if (!win || !(win.maximized || win.snap)) return;
	const r = win.restore ?? { x: 100, y: 80, w: 640, h: 420 };
	win.maximized = false;
	win.snap = null;
	win.w = r.w;
	win.h = r.h;
	win.y = anchor ? anchor.y : r.y;
	win.x = anchor ? Math.round(anchor.x - r.w * anchor.ratio) : r.x;
	win.restore = null;
	clampToWork(win);
}

export function moveBy(id, x, y) {
	const win = find(id);
	if (!win) return;
	const area = workArea();
	win.x = x;
	win.y = Math.min(Math.max(area.y, y), area.y + area.h - 40);
}

export function resizeTo(id, rect) {
	const win = find(id);
	if (!win) return;
	Object.assign(win, rect);
}

export function toast(message, ms = 2800) {
	if (!message) return;
	const t = { id: uid(), message };
	wm.toasts.push(t);
	setTimeout(() => {
		const i = wm.toasts.findIndex((x) => x.id === t.id);
		if (i !== -1) wm.toasts.splice(i, 1);
	}, ms);
}

/** Keep windows reachable when the browser window shrinks. */
export function syncViewport() {
	wm.vw = innerWidth;
	wm.vh = innerHeight;
	for (const win of wm.windows) if (!win.maximized && !win.snap) clampToWork(win);
}

export function minimizeAll() {
	for (const w of wm.windows) w.minimized = true;
	wm.activeId = null;
}
export function closeAll() {
	wm.windows.length = 0;
	wm.activeId = null;
}
