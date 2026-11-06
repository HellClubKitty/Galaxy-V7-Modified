// Spotify "Now Playing" for the desktop.
//
// Spotify's own site can't be read from inside a proxied window, so this talks to the Spotify Web
// API directly. It logs in with PKCE (no client secret; you only paste your app's Client ID), then
// polls /me/player. That means it follows whatever you are playing on ANY device: the Spotify
// window in this desktop, your phone, the desktop app.
//
// Spotify rules (checked Nov 2026): the redirect URI must be https, or http://127.0.0.1 (never
// "localhost"); controlling playback needs Premium; apps in Development Mode need a Premium owner.
import { browser } from '$app/environment';
import { loadSetting, saveSetting, onSettingChange } from '$lib/utils/localspace.js';

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
const PKCE_KEY = 'galaxy:spotifyPkce';

export const spConfig = $state({ clientId: '' });

export const sp = $state({
	connected: false,
	/** disconnected | idle | playing | paused | error */
	status: 'disconnected',
	track: /** @type {null | { id: string, name: string, artist: string, album: string, art: string, url: string }} */ (null),
	isPlaying: false,
	progress: 0,
	duration: 0,
	shuffle: false,
	/** off | context | track */
	repeat: 'off',
	volume: /** @type {number | null} */ (null),
	volumeOk: true,
	device: '',
	deviceId: '',
	queue: /** @type {any[]} */ ([]),
	devices: /** @type {any[]} */ ([]),
	error: '',
	/** Bumps every time a different track starts, so the UI can flash a banner. */
	changeSeq: 0
});

let auth = null; // { access, refresh, expires, clientId }
let base = 0; // progress at the last poll
let syncAt = 0; // performance.now() at the last poll
let backoff = 0;
let timer;
let ticker;
let pollMode = false;

export const redirectUri = () => (browser ? `${location.origin}/spotify` : '');

/* ---------- PKCE ---------- */
const b64url = (buf) =>
	btoa(String.fromCharCode(...new Uint8Array(buf)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
const randomString = (n) => b64url(crypto.getRandomValues(new Uint8Array(n))).slice(0, n);
const challengeOf = async (verifier) => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));

/** Open the Spotify login. Call this straight from a click so the popup isn't blocked. */
export async function startAuth() {
	const clientId = spConfig.clientId.trim();
	if (!clientId) throw new Error('Paste your Spotify Client ID first.');
	if (!crypto?.subtle) throw new Error('Spotify login needs https:// or http://127.0.0.1 (not localhost or plain http).');
	const pop = window.open('', 'galaxy-spotify', 'width=480,height=720');
	const verifier = randomString(96);
	const state = randomString(16);
	localStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, clientId, redirect: redirectUri() }));
	const url =
		AUTH_URL +
		'?' +
		new URLSearchParams({
			response_type: 'code',
			client_id: clientId,
			scope: SCOPES,
			redirect_uri: redirectUri(),
			state,
			code_challenge_method: 'S256',
			code_challenge: await challengeOf(verifier)
		});
	if (pop) pop.location.href = url;
	else (window.top ?? window).location.href = url; // popup blocked: log in in this tab instead
}

/** Called by the /spotify callback page. */
export async function completeAuth(code, state) {
	let saved = null;
	try {
		saved = JSON.parse(localStorage.getItem(PKCE_KEY) || 'null');
	} catch {}
	if (!saved || saved.state !== state) throw new Error('That login expired. Close this and press Connect again.');
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: saved.clientId,
			grant_type: 'authorization_code',
			code,
			redirect_uri: saved.redirect,
			code_verifier: saved.verifier
		})
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error_description || data.error || 'Spotify refused the login.');
	await saveSetting('spotifyAuth', {
		access: data.access_token,
		refresh: data.refresh_token,
		expires: Date.now() + data.expires_in * 1000 - 30000,
		clientId: saved.clientId
	});
	localStorage.removeItem(PKCE_KEY);
}

/* ---------- tokens + requests ---------- */
async function token() {
	if (!auth) return null;
	if (Date.now() < auth.expires) return auth.access;
	try {
		const res = await fetch(TOKEN_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: auth.refresh, client_id: auth.clientId })
		});
		if (res.status === 400 || res.status === 401) {
			await disconnect(); // the grant was revoked
			return null;
		}
		if (!res.ok) return null;
		const d = await res.json();
		auth = { ...auth, access: d.access_token, refresh: d.refresh_token ?? auth.refresh, expires: Date.now() + d.expires_in * 1000 - 30000 };
		saveSetting('spotifyAuth', auth);
		return auth.access;
	} catch {
		return null;
	}
}

async function api(path, method = 'GET', body = null, retry = true) {
	const t = await token();
	if (!t) throw new Error('not signed in');
	const res = await fetch(API + path, {
		method,
		headers: { Authorization: `Bearer ${t}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
		body: body ? JSON.stringify(body) : undefined
	});
	if (res.status === 401 && retry && auth) {
		auth.expires = 0;
		return api(path, method, body, false);
	}
	return res;
}

const pickArt = (images) => (images?.length ? (images[1] ?? images[0]).url : '');

async function poll() {
	if (!auth) return;
	let res;
	try {
		res = await api('/me/player?additional_types=track,episode');
	} catch {
		if (auth) {
			sp.status = 'error';
			sp.error = 'Can’t reach Spotify right now.';
		}
		return;
	}
	if (res.status === 429) {
		backoff = (Number(res.headers.get('retry-after')) || 5) * 1000;
		return;
	}
	if (res.status === 204) {
		// Nothing is playing anywhere. Keep the last track on screen, just not as "playing".
		sp.status = 'idle';
		sp.isPlaying = false;
		sp.error = '';
		return;
	}
	if (res.status === 403) {
		sp.status = 'error';
		sp.error = 'Spotify blocked this app. In Development Mode the app owner needs Premium and you must be added as a user.';
		return;
	}
	if (!res.ok) {
		sp.status = 'error';
		sp.error = `Spotify said ${res.status}.`;
		return;
	}
	const d = await res.json().catch(() => null);
	const item = d?.item;
	if (!item) {
		sp.status = 'idle';
		sp.isPlaying = false;
		return;
	}
	const track = {
		id: item.id ?? item.uri,
		name: item.name,
		artist: (item.artists ?? []).map((a) => a.name).join(', ') || item.show?.publisher || item.show?.name || '',
		album: item.album?.name ?? item.show?.name ?? '',
		art: pickArt(item.album?.images ?? item.images),
		url: item.external_urls?.spotify ?? ''
	};
	if (sp.track?.id !== track.id) {
		const first = !sp.track;
		sp.track = track;
		if (!first && d.is_playing) sp.changeSeq++;
	}
	sp.isPlaying = !!d.is_playing;
	sp.status = d.is_playing ? 'playing' : 'paused';
	sp.duration = item.duration_ms ?? 0;
	sp.shuffle = !!d.shuffle_state;
	sp.device = d.device?.name ?? '';
	sp.deviceId = d.device?.id ?? '';
	sp.repeat = d.repeat_state ?? 'off';
	sp.volume = d.device?.volume_percent ?? null;
	sp.volumeOk = d.device?.supports_volume !== false && sp.volume !== null;
	sp.error = '';
	base = d.progress_ms ?? 0;
	sp.progress = base;
	syncAt = performance.now();
}

function schedule(ms) {
	clearTimeout(timer);
	if (!pollMode || !auth) return;
	timer = setTimeout(async () => {
		await poll();
		const wait = backoff || (document.hidden ? 15000 : sp.isPlaying ? 3000 : 6000);
		backoff = 0;
		schedule(wait);
	}, ms);
}

function startTicker() {
	clearInterval(ticker);
	ticker = setInterval(() => {
		if (!sp.isPlaying || !sp.duration) return;
		sp.progress = Math.min(sp.duration, base + (performance.now() - syncAt));
		// The song just ended: ask Spotify what comes next instead of waiting for the next poll.
		if (sp.progress >= sp.duration) {
			base = sp.duration;
			syncAt = performance.now();
			schedule(700);
		}
	}, 250);
}

/* ---------- controls ---------- */
export async function control(action) {
	const routes = {
		play: ['PUT', '/me/player/play'],
		pause: ['PUT', '/me/player/pause'],
		next: ['POST', '/me/player/next'],
		prev: ['POST', '/me/player/previous']
	};
	const [method, path] = routes[action] ?? [];
	if (!path) return { ok: false, message: '' };
	if (action === 'play' || action === 'pause') {
		sp.isPlaying = action === 'play';
		sp.status = sp.isPlaying ? 'playing' : 'paused';
		base = sp.progress;
		syncAt = performance.now();
	}
	try {
		const res = await api(path, method);
		schedule(450);
		if (res.status === 403) return { ok: false, message: 'Spotify Premium is needed to control playback.' };
		if (res.status === 404) return { ok: false, message: 'No active device. Press play in Spotify somewhere first.' };
		return { ok: res.ok, message: res.ok ? '' : `Spotify said ${res.status}.` };
	} catch {
		return { ok: false, message: 'Can’t reach Spotify right now.' };
	}
}

export async function seek(ms) {
	const to = Math.max(0, Math.round(ms));
	base = to;
	sp.progress = to;
	syncAt = performance.now();
	try {
		await api(`/me/player/seek?position_ms=${to}`, 'PUT');
	} catch {}
	schedule(500);
}

/* ---------- extras for the HUD ---------- */
async function put(path, method = 'PUT', body = null) {
	try {
		const res = await api(path, method, body);
		schedule(450);
		if (res.status === 403) return { ok: false, message: 'Spotify Premium is needed for that.' };
		if (res.status === 404) return { ok: false, message: 'No active device. Press play in Spotify somewhere first.' };
		return { ok: res.ok, message: res.ok ? '' : `Spotify said ${res.status}.` };
	} catch {
		return { ok: false, message: 'Can’t reach Spotify right now.' };
	}
}

export function setVolume(percent) {
	const v = Math.max(0, Math.min(100, Math.round(percent)));
	sp.volume = v;
	return put(`/me/player/volume?volume_percent=${v}`);
}
export function toggleShuffle() {
	sp.shuffle = !sp.shuffle;
	return put(`/me/player/shuffle?state=${sp.shuffle}`);
}
export function cycleRepeat() {
	sp.repeat = sp.repeat === 'off' ? 'context' : sp.repeat === 'context' ? 'track' : 'off';
	return put(`/me/player/repeat?state=${sp.repeat}`);
}
export async function loadQueue() {
	try {
		const res = await api('/me/player/queue');
		if (!res.ok) return;
		const d = await res.json();
		sp.queue = (d.queue ?? []).slice(0, 15).map((t) => ({
			id: t.id ?? t.uri,
			name: t.name,
			artist: (t.artists ?? []).map((a) => a.name).join(', ') || t.show?.name || '',
			art: pickArt(t.album?.images ?? t.images ?? [])
		}));
	} catch {}
}
export async function loadDevices() {
	try {
		const res = await api('/me/player/devices');
		if (!res.ok) return;
		const d = await res.json();
		sp.devices = (d.devices ?? []).map((x) => ({ id: x.id, name: x.name, type: x.type, active: x.is_active, volume: x.volume_percent }));
	} catch {}
}
export async function transfer(id) {
	const r = await put('/me/player', 'PUT', { device_ids: [id], play: true });
	setTimeout(loadDevices, 700);
	return r;
}

/* ---------- lifecycle ---------- */
function applyAuth(value) {
	auth = value && value.access ? value : null;
	sp.connected = !!auth;
	if (!auth) {
		sp.status = 'disconnected';
		sp.track = null;
		sp.isPlaying = false;
		sp.error = '';
		clearTimeout(timer);
	} else {
		if (sp.status === 'disconnected') sp.status = 'idle';
		if (pollMode) schedule(0);
	}
}

export async function disconnect() {
	applyAuth(null);
	await saveSetting('spotifyAuth', null);
}

export function setClientId(value) {
	spConfig.clientId = value;
	saveSetting('spotify', { clientId: value });
}

let started = false;
/** `poll: false` only loads the login state (used by the Settings pane); the desktop polls. */
export function initSpotify({ poll: doPoll = true } = {}) {
	if (started || !browser) return () => {};
	started = true;
	pollMode = doPoll;
	loadSetting('spotify', null).then((v) => v?.clientId && (spConfig.clientId = v.clientId)).catch(() => {});
	loadSetting('spotifyAuth', null).then(applyAuth).catch(() => {});
	const offs = [
		onSettingChange('spotifyAuth', applyAuth),
		onSettingChange('spotify', (v) => v?.clientId !== undefined && (spConfig.clientId = v.clientId))
	];
	const vis = () => !document.hidden && pollMode && auth && schedule(0);
	document.addEventListener('visibilitychange', vis);
	if (doPoll) startTicker();
	return () => {
		started = false;
		clearTimeout(timer);
		clearInterval(ticker);
		document.removeEventListener('visibilitychange', vis);
		offs.forEach((off) => off());
	};
}
