/* Settings storage: IndexedDB through `localspace`, falling back to localStorage.
 *
 * The library is imported lazily and every call is guarded. A storage failure (private mode,
 * blocked IndexedDB, a broken import) used to throw while the page was starting, which stopped
 * Svelte from hydrating and left every button dead. Now it just degrades to localStorage. */

import { browser } from '$app/environment';

const channel = browser && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('galaxy-settings') : null;

let storePromise = null;
function getStore() {
	if (!browser) return Promise.resolve(null);
	storePromise ??= import('localspace')
		.then((m) => (m.default ?? m).createInstance({ name: 'galaxy', storeName: 'settings' }))
		.catch((e) => {
			console.warn('localspace unavailable, using localStorage', e);
			return null;
		});
	return storePromise;
}

const LS = 'galaxy:';
const lsGet = (key) => {
	try {
		const raw = localStorage.getItem(LS + key);
		return raw === null ? null : JSON.parse(raw);
	} catch {
		return null;
	}
};
const lsSet = (key, value) => {
	try {
		localStorage.setItem(LS + key, JSON.stringify(value));
	} catch {}
};

/** Subscribe to live changes of one setting, from any same-origin tab or iframe. */
export function onSettingChange(key, callback) {
	if (!channel) return () => {};
	const handler = (event) => {
		if (event.data?.key === key) callback(event.data.value);
	};
	channel.addEventListener('message', handler);
	return () => channel.removeEventListener('message', handler);
}

/** Read a setting. `migrate` converts a legacy plain localStorage string, if one exists. */
export async function loadSetting(key, fallback, migrate = (raw) => raw) {
	if (!browser) return fallback;
	let value = null;
	try {
		const store = await getStore();
		value = store ? await store.getItem(key) : lsGet(key);
	} catch {
		value = lsGet(key);
	}
	if (value === null || value === undefined) {
		try {
			const legacy = localStorage.getItem(key);
			if (legacy !== null) {
				value = migrate(legacy);
				await saveSetting(key, value);
				localStorage.removeItem(key);
			}
		} catch {
			value = null;
		}
	}
	return value ?? fallback;
}

/** Persist a setting. Pass plain values (use $state.snapshot for state proxies). */
export async function saveSetting(key, value) {
	if (!browser) return;
	try {
		const store = await getStore();
		if (store) await store.setItem(key, value);
		else lsSet(key, value);
	} catch (error) {
		console.error(`Failed to persist setting "${key}":`, error);
		lsSet(key, value);
	}
	try {
		channel?.postMessage({ key, value });
	} catch {}
}
