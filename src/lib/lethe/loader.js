const pending = new Map();

function inject(src, ordered) {
	if (pending.has(src)) return pending.get(src);
	/** @type {Promise<void>} */
	const p = new Promise((resolve, reject) => {
		const s = document.createElement('script');
		s.src = src;
		s.dataset.mod = src;
		// async=false: download in parallel but still execute in insertion order.
		s.async = !ordered;
		s.onload = () => resolve();
		s.onerror = () => {
			pending.delete(src);
			s.remove();
			reject(new Error(`Failed to load ${src}`));
		};
		document.head.appendChild(s);
	});
	pending.set(src, p);
	return p;
}

export function loadScript(src) {
	return inject(src, false);
}

/** Load several scripts at once; they run in the order given, but download concurrently. */
export function loadScriptsSequential(srcs) {
	return Promise.all(srcs.map((src) => inject(src, true)));
}
