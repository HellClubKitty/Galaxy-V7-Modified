import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { MAX_EXTENSION_BYTES, createHopiumExtensionApi, matchesExtensionPattern, sandboxExtensionCode } from '../src/lib/lethe/browser-extensions.js';

test('creates a richer Hopium extension API for larger scripts', () => {
	const api = createHopiumExtensionApi('demo');
	assert.match(api, /notify: \(text, timeout\)/);
	assert.match(api, /bar: \{/);
	assert.match(api, /storage: \(\(\) => \{/);
	assert.match(api, /run: \(app\)/);
	assert.match(api, /window\.hopium = hopium/);
	assert.match(api, /unsafeWindow/);
	assert.match(api, /window, 'indexedDB'/);
});

test('provides in-memory IndexedDB in the sandbox', async () => {
	const window = {};
	runInNewContext(createHopiumExtensionApi('demo'), {
		window,
		parent: { postMessage() {} },
		addEventListener() {},
		EventTarget,
		Event,
		DOMException,
		setTimeout,
		structuredClone
	});

	const db = await new Promise((resolve, reject) => {
		const request = window.indexedDB.open('test-db', 1);
		request.onupgradeneeded = () => request.result.createObjectStore('items');
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	const store = db.transaction('items', 'readwrite').objectStore('items');
	await new Promise((resolve, reject) => {
		const request = store.put({ value: 42 }, 'answer');
		request.onsuccess = resolve;
		request.onerror = () => reject(request.error);
	});
	const result = await new Promise((resolve, reject) => {
		const request = db.transaction('items').objectStore('items').get('answer');
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	assert.deepEqual(result, { value: 42 });
});

test('keeps Vencord userscript declarations local for unsafeWindow exposure', () => {
	const context = { parent: { postMessage() {} }, addEventListener() {}, setTimeout, EventTarget, Event, DOMException, structuredClone };
	context.window = context;
	runInNewContext(
		`${createHopiumExtensionApi('vencord')}\n${sandboxExtensionCode("var Vencord = { ready: true }; Object.defineProperty(unsafeWindow, 'Vencord', { get: () => Vencord });")}`,
		context
	);
	assert.equal(context.Vencord.ready, true);
	assert.equal(context.unsafeWindow.Vencord.ready, true);
});

test('allows longer extension scripts up to the configured limit', () => {
	const script = 'hopium.bar.set("' + 'x'.repeat(Math.max(1, MAX_EXTENSION_BYTES - 128)) + '");';
	assert.ok(script.length < MAX_EXTENSION_BYTES);
	assert.ok(MAX_EXTENSION_BYTES > 200_000);
});

test('supports all HTTP and HTTPS pages', () => {
	assert.equal(matchesExtensionPattern('<all_urls>', 'https://example.com/path'), true);
	assert.equal(matchesExtensionPattern('<all_urls>', 'file:///tmp/test.html'), false);
});

test('matches exact hosts and paths with wildcards', () => {
	assert.equal(matchesExtensionPattern('https://example.com/*', 'https://example.com/about'), true);
	assert.equal(matchesExtensionPattern('https://example.com/about', 'https://example.com/about#section'), true);
	assert.equal(matchesExtensionPattern('https://example.com/*', 'https://other.example.com/about'), false);
	assert.equal(matchesExtensionPattern('*://example.com/docs/*', 'http://example.com/docs/start'), true);
	assert.equal(matchesExtensionPattern('*://example.com/docs/*', 'https://example.com/blog/start'), false);
});

test('matches wildcard subdomains, including the base domain', () => {
	assert.equal(matchesExtensionPattern('https://*.example.com/*', 'https://example.com/'), true);
	assert.equal(matchesExtensionPattern('https://*.example.com/*', 'https://shop.example.com/item'), true);
	assert.equal(matchesExtensionPattern('https://*.example.com/*', 'https://example.net/'), false);
});

test('rejects unsupported or malformed patterns and URLs', () => {
	assert.equal(matchesExtensionPattern('file:///*', 'https://example.com/'), false);
	assert.equal(matchesExtensionPattern('https://example.com/*', 'not a URL'), false);
	assert.equal(matchesExtensionPattern('example.com', 'https://example.com/'), false);
});
