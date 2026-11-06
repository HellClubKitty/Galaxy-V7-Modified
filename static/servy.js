importScripts('/glass/glass.bundle.js');
importScripts('/glass/glass.config.js');
importScripts('/glass/glass.sw.js');
importScripts('/poly/polygon.all.js');
importScripts('/prism/prism.sw.js');

const uv = new UVServiceWorker();
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

function isPrismProxyRequest(event) {
	try {
		// A Scramjet v2 request has the form /prism/<controller-id>/<frame-id>/<encoded-url>.
		// Do not match the static bundle files such as /prism/prism.sw.js.
		return /^\/prism\/[^/]+\/[^/]+\//.test(new URL(event.request.url).pathname);
	} catch {
		return false;
	}
}

async function waitForPrismRoute(event, timeout = 1500) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if ($scramjetController?.shouldRoute?.(event)) return true;
		// The Scramjet worker re-announces its boot to open tabs shortly after startup.
		// Their controllers then resend $controller$init, repopulating the worker's route table.
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	return Boolean($scramjetController?.shouldRoute?.(event));
}

async function handleRequest(event) {
	// A service worker can be restarted at any time. Scramjet v2 keeps its controller
	// registrations in memory, so the first /prism/ fetch can arrive before open tabs
	// have received $controller$swrevive and re-registered. Hold that request briefly
	// instead of letting it fall through to the app server's static /prism/ handler (404).
	if (isPrismProxyRequest(event)) {
		if (typeof $scramjetController === 'undefined') {
			return new Response('Scramjet v2 is unavailable in the proxy service worker.', {
				status: 503,
				headers: { 'Content-Type': 'text/plain; charset=utf-8' }
			});
		}

		if (!(await waitForPrismRoute(event))) {
			return new Response(
				'Scramjet could not restore this tab after a service-worker restart. Reload the Hopium browser tab and try again.',
				{ status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
			);
		}

		return $scramjetController.route(event);
	}

	// UV does not require a persisted Scramjet config, so check it first for non-Prism URLs.
	if (uv.route(event)) return uv.fetch(event);

	// Scramjet v2 registers its own route through the shared service worker.
	if (typeof $scramjetController !== 'undefined' && $scramjetController.shouldRoute(event)) {
		return $scramjetController.route(event);
	}

	// On a fresh install the worker may receive ordinary app requests before a Scramjet
	// controller has saved its config in IndexedDB. `route()` dereferences config.prefix,
	// so only call it after a config actually exists; otherwise pass the request through.
	if (!scramjet.config) {
		try {
			await scramjet.loadConfig();
		} catch (error) {
			console.error('Could not load Scramjet configuration:', error);
		}
	}

	if (scramjet.config && scramjet.route(event)) {
		return scramjet.fetch(event);
	}

	return fetch(event.request);
}

self.addEventListener('fetch', (event) => {
	event.respondWith(
		handleRequest(event).catch((error) => {
			console.error('Proxy service worker request failed:', error);
			return new Response(`Proxy request failed: ${error?.message || error}`, {
				status: 502,
				headers: { 'Content-Type': 'text/plain; charset=utf-8' }
			});
		})
	);
});
