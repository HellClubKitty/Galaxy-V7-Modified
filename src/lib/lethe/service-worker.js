const SERVICE_WORKER_URL = '/servy.js';
const SERVICE_WORKER_SCOPE = '/';
const STARTUP_TIMEOUT = 15_000;

let registrationPromise;
const scramjetInitPromises = new WeakMap();

function waitFor(predicate, subscribe, description, timeout = STARTUP_TIMEOUT) {
	if (predicate()) return Promise.resolve();

	return new Promise((resolve, reject) => {
		let finished = false;
		const cleanup = () => {
			if (finished) return;
			finished = true;
			clearTimeout(timer);
			subscribe?.removeEventListener?.('change', check);
			subscribe?.removeEventListener?.('statechange', check);
			subscribe?.removeEventListener?.('controllerchange', check);
		};
		const check = () => {
			if (!predicate()) return;
			cleanup();
			resolve();
		};
		const timer = setTimeout(() => {
			cleanup();
			reject(new Error(`Timed out waiting for the ${description}. Check that /servy.js is reachable and that this site is using HTTPS or localhost.`));
		}, timeout);

		subscribe?.addEventListener?.('change', check);
		subscribe?.addEventListener?.('statechange', check);
		subscribe?.addEventListener?.('controllerchange', check);
		check();
	});
}

async function startServiceWorker() {
	if (typeof window === 'undefined' || typeof navigator === 'undefined') {
		throw new Error('The proxy service worker can only be started in a browser.');
	}
	if (!('serviceWorker' in navigator)) {
		throw new Error('Service workers are not supported by this browser.');
	}
	if (!window.isSecureContext) {
		throw new Error('Service workers require HTTPS or localhost. Open Hopium through a secure origin.');
	}

	let registration;
	try {
		registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
			scope: SERVICE_WORKER_SCOPE,
			type: 'classic',
			updateViaCache: 'none'
		});
	} catch (error) {
		throw new Error(`Could not register ${SERVICE_WORKER_URL}: ${error?.message || error}`);
	}

	const activeWorker = () => registration.active;
	const installingWorker = () => registration.installing ?? registration.waiting;

	if (activeWorker()?.state !== 'activated') {
		const worker = installingWorker();
		if (worker) {
			await waitFor(
				() => activeWorker()?.state === 'activated',
				worker,
				'proxy service worker activation'
			);
		} else {
			// An existing registration can be active before this page gets its first controller.
			await waitFor(
				() => activeWorker()?.state === 'activated',
				registration,
				'proxy service worker activation'
			);
		}
	}

	// `register()` resolving does not mean this page is controlled yet. Without this wait,
	// the first proxied navigation can escape interception and fail with a Scramjet route error.
	if (!navigator.serviceWorker.controller) {
		await waitFor(
			() => Boolean(navigator.serviceWorker.controller),
			navigator.serviceWorker,
			'page control by the proxy service worker'
		);
	}

	const worker = navigator.serviceWorker.controller ?? activeWorker();
	if (!worker || worker.state !== 'activated') {
		throw new Error('The proxy service worker activated but is not controlling this page. Reload Hopium and try again.');
	}

	return { registration, worker };
}

/** Register /servy.js once, wait for activation and ensure this page is controlled by it. */
export function ensureProxyServiceWorker() {
	if (!registrationPromise) {
		registrationPromise = startServiceWorker().catch((error) => {
			// A rejected promise must not poison later attempts. The UI can retry after a fix.
			registrationPromise = null;
			throw error;
		});
	}
	return registrationPromise;
}

/** Initialize legacy Scramjet only after its worker can receive the configuration message. */
export function initScramjet(controller) {
	if (!controller || typeof controller.init !== 'function') {
		return Promise.reject(new Error('Scramjet controller is unavailable. Load the Scramjet bundle first.'));
	}

	let task = scramjetInitPromises.get(controller);
	if (!task) {
		task = (async () => {
			await ensureProxyServiceWorker();
			await controller.init();
			return controller;
		})().catch((error) => {
			scramjetInitPromises.delete(controller);
			throw error;
		});
		scramjetInitPromises.set(controller, task);
	}
	return task;
}
