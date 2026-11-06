import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const workerSource = await readFile(new URL('../static/servy.js', import.meta.url), 'utf8');

/**
 * @param {{ savedConfig?: { prefix: string, files: { wasm: string } } | null, prismReadyAfterMs?: number }} [options]
 */
function createWorker({ savedConfig = null, prismReadyAfterMs = 0 } = {}) {
	const listeners = new Map();
	const state = { prismReady: false };
	if (prismReadyAfterMs > 0) setTimeout(() => { state.prismReady = true; }, prismReadyAfterMs);
	const context = {
		URL,
		Response,
		setTimeout,
		Date,
		console: { log() {}, warn() {}, error() {} },
		importScripts() {},
		self: {
			addEventListener(name, callback) {
				listeners.set(name, callback);
			}
		},
		UVServiceWorker: class {
			route() { return false; }
			async fetch() { return new Response('uv'); }
		},
		$scramjetLoadWorker: () => ({
			ScramjetServiceWorker: class {
				constructor() { this.config = null; }
				async loadConfig() { this.config = savedConfig; }
				route(event) {
					if (!this.config) throw new TypeError('Cannot read properties of null (reading prefix)');
					return event.request.url.includes('/polygon/');
				}
				async fetch() { return new Response('scramjet'); }
			}
		}),
		$scramjetController: {
			shouldRoute: () => state.prismReady,
			async route() { return new Response('prism'); }
		},
		fetch: async (request) => new Response(`network:${request.url}`)
	};
	vm.runInNewContext(workerSource, context, { filename: 'servy.js' });
	return listeners.get('fetch');
}

/**
 * @param {(event: { request: { url: string }, respondWith: (response: Promise<Response> | Response) => void }) => void} handler
 * @param {string} url
 * @returns {Promise<Response>}
 */
function dispatchFetch(handler, url) {
	/** @type {Promise<Response> | Response | undefined} */
	let response;
	handler({ request: { url }, respondWith(value) { response = value; } });
	if (!response) throw new Error('The service worker did not handle the request.');
	return Promise.resolve(response);
}

test('fresh install without Scramjet config passes ordinary requests through', async () => {
	const handler = createWorker();
	const response = await dispatchFetch(handler, 'https://hopium.local/');
	assert.equal(response.status, 200);
	assert.equal(await response.text(), 'network:https://hopium.local/');
});

test('configured Scramjet routes encoded proxy requests', async () => {
	const handler = createWorker({ savedConfig: { prefix: '/polygon/', files: { wasm: '/poly.wasm' } } });
	const response = await dispatchFetch(handler, 'https://hopium.local/polygon/encoded');
	assert.equal(response.status, 200);
	assert.equal(await response.text(), 'scramjet');
});


test('Scramjet v2 requests wait for controller registration after a worker restart', async () => {
	const handler = createWorker({ prismReadyAfterMs: 75 });
	const response = await dispatchFetch(
		handler,
		'https://hopium.local/prism/ssp31j2m/61plfpe3/CkNBFkoPFxwRUwdNFAETTQBQ'
	);
	assert.equal(response.status, 200);
	assert.equal(await response.text(), 'prism');
});

test('Scramjet static bundle requests are not mistaken for proxied pages', async () => {
	const handler = createWorker();
	const response = await dispatchFetch(handler, 'https://hopium.local/prism/prism.sw.js');
	assert.equal(response.status, 200);
	assert.equal(await response.text(), 'network:https://hopium.local/prism/prism.sw.js');
});


test('inline data image URLs routed through Prism survive a worker restart', async () => {
	const handler = createWorker({ prismReadyAfterMs: 50 });
	const response = await dispatchFetch(
		handler,
		'https://hopium.local/prism/ssp31j2m/61plfpe3/data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
	);
	assert.equal(response.status, 200);
	assert.equal(await response.text(), 'prism');
});

test('unavailable Prism controller returns a diagnostic instead of an app-server 404', async () => {
	const handler = createWorker();
	const response = await dispatchFetch(
		handler,
		'https://hopium.local/prism/ssp31j2m/61plfpe3/CkNBFkoPFxwRUwdNFAETTQBQ'
	);
	assert.equal(response.status, 503);
	assert.match(await response.text(), /Reload the Hopium browser tab/);
});
