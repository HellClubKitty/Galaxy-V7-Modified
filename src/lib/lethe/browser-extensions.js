export const MAX_EXTENSION_BYTES = 1_000_000;

/** Keep userscript declarations local so they can be exposed on unsafeWindow explicitly. */
export function sandboxExtensionCode(code) {
	return `(function() {\n${code}\n}).call(window);`;
}

/** Build the runtime API exposed to sandboxed extension scripts. */
export function createHopiumExtensionApi(id) {
	return `
const __id = ${JSON.stringify(id)};
const __post = (m) => parent.postMessage({ hopium: __id, ...m }, '*');
const __h = {};
const __storage = (() => {
  const values = new Map();
  const normalized = (key) => 'hopium:' + String(key);
  const safeStorage = {
    getItem: (key) => {
      const name = normalized(key);
      return values.has(name) ? String(values.get(name)) : null;
    },
    setItem: (key, value) => {
      values.set(normalized(key), String(value));
      return value;
    },
    removeItem: (key) => {
      values.delete(normalized(key));
    },
    clear: () => {
      values.clear();
    },
    key: (index) => {
      const keys = [...values.keys()].filter((name) => name.startsWith('hopium:'));
      return keys[index] ? keys[index].slice('hopium:'.length) : null;
    },
    get length() {
      return [...values.keys()].filter((name) => name.startsWith('hopium:')).length;
    }
  };
  return { values, safeStorage };
})();
const __databases = new Map();
const __clone = (value) => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return value == null ? value : JSON.parse(JSON.stringify(value));
};
const __request = (operation) => {
  const request = new EventTarget();
  request.result = undefined;
  request.error = null;
  request.onsuccess = null;
  request.onerror = null;
  request.transaction = null;
  const run = () => {
    try {
      request.result = operation();
      request.dispatchEvent(new Event('success'));
      request.onsuccess?.call(request, { target: request });
    } catch (error) {
      request.error = error;
      request.dispatchEvent(new Event('error'));
      request.onerror?.call(request, { target: request });
    }
  };
  setTimeout(run, 0);
  return request;
};
const __makeDatabase = (name, state) => {
  const db = {
    name,
    version: state.version,
    objectStoreNames: {
      contains: (storeName) => state.stores.has(String(storeName)),
      item: (index) => [...state.stores.keys()][index] ?? null,
      get length() { return state.stores.size; }
    },
    createObjectStore: (storeName, options = {}) => {
      storeName = String(storeName);
      if (state.stores.has(storeName)) throw new DOMException('The object store already exists.', 'ConstraintError');
      const store = { keyPath: options.keyPath ?? null, autoIncrement: options.autoIncrement === true, nextKey: 1, records: new Map() };
      state.stores.set(storeName, store);
      return __makeObjectStore(store);
    },
    deleteObjectStore: (storeName) => {
      if (!state.stores.delete(String(storeName))) throw new DOMException('The object store does not exist.', 'NotFoundError');
    },
    transaction: (names) => {
      const requested = Array.isArray(names) ? names : [names];
      const stores = new Map();
      for (const storeName of requested) {
        const store = state.stores.get(String(storeName));
        if (!store) throw new DOMException('The object store does not exist.', 'NotFoundError');
        stores.set(String(storeName), __makeObjectStore(store));
      }
      return {
        objectStore: (storeName) => {
          const store = stores.get(String(storeName));
          if (!store) throw new DOMException('The object store is not in this transaction.', 'NotFoundError');
          return store;
        },
        abort: () => {},
        commit: () => {}
      };
    },
    close: () => {}
  };
  return db;
};
const __makeObjectStore = (store) => {
  const keyFor = (value, key) => {
    if (key !== undefined) return key;
    if (store.keyPath) {
      const path = String(store.keyPath).split('.');
      let found = value;
      for (const part of path) found = found?.[part];
      if (found !== undefined) return found;
    }
    if (store.autoIncrement) return store.nextKey++;
    throw new DOMException('A key is required for this object store.', 'DataError');
  };
  return {
    get: (key) => __request(() => __clone(store.records.get(key))),
    getKey: (key) => __request(() => store.records.has(key) ? key : undefined),
    getAll: (query, count) => __request(() => [...store.records].filter(([key]) => query === undefined || key === query).slice(0, count).map(([, value]) => __clone(value))),
    getAllKeys: (query, count) => __request(() => [...store.records.keys()].filter((key) => query === undefined || key === query).slice(0, count)),
    count: (key) => __request(() => key === undefined ? store.records.size : Number(store.records.has(key))),
    put: (value, key) => __request(() => {
      const recordKey = keyFor(value, key);
      store.records.set(recordKey, __clone(value));
      return recordKey;
    }),
    add: (value, key) => __request(() => {
      const recordKey = keyFor(value, key);
      if (store.records.has(recordKey)) throw new DOMException('The key already exists.', 'ConstraintError');
      store.records.set(recordKey, __clone(value));
      return recordKey;
    }),
    delete: (key) => __request(() => store.records.delete(key)),
    clear: () => __request(() => store.records.clear()),
    createIndex: () => { throw new DOMException('Indexes are not supported by the sandbox storage shim.', 'NotSupportedError'); },
    index: () => { throw new DOMException('Indexes are not supported by the sandbox storage shim.', 'NotSupportedError'); }
  };
};
const __safeIndexedDB = {
  open: (name, version) => {
    name = String(name);
    const request = new EventTarget();
    request.result = undefined;
    request.error = null;
    request.transaction = null;
    request.onupgradeneeded = null;
    request.onsuccess = null;
    request.onerror = null;
    setTimeout(() => {
      let state = __databases.get(name);
      const oldVersion = state?.version ?? 0;
      if (!state) {
        state = { version: 0, stores: new Map() };
        __databases.set(name, state);
      }
      const nextVersion = version === undefined ? (oldVersion || 1) : Number(version);
      if (!Number.isInteger(nextVersion) || nextVersion < 1 || nextVersion < oldVersion) {
        request.error = new DOMException('The requested database version is invalid.', 'VersionError');
        request.dispatchEvent(new Event('error'));
        request.onerror?.call(request, { target: request });
        return;
      }
      request.result = __makeDatabase(name, state);
      if (nextVersion > oldVersion) {
        state.version = nextVersion;
        request.result.version = nextVersion;
        const event = { target: request, oldVersion, newVersion: nextVersion };
        request.dispatchEvent(new Event('upgradeneeded'));
        request.onupgradeneeded?.call(request, event);
      }
      request.dispatchEvent(new Event('success'));
      request.onsuccess?.call(request, { target: request });
    }, 0);
    return request;
  },
  deleteDatabase: (name) => __request(() => __databases.delete(String(name))),
  databases: () => Promise.resolve([...__databases].map(([name, state]) => ({ name, version: state.version })))
};
const hopium = {
  id: __id,
  toast: (text, timeout) => __post({
    type: 'toast',
    text: String(text ?? '').slice(0, 140),
    duration: Number.isFinite(timeout) ? Math.max(0, Math.min(Number(timeout), 15000)) : undefined
  }),
  notify: (text, timeout) => hopium.toast(text, timeout),
  bar: {
    set: (text) => __post({ type: 'bar', text: text == null ? '' : String(text).slice(0, 24) }),
    clear: () => hopium.bar.set(''),
    update: (text) => hopium.bar.set(text)
  },
  open: (app) => __post({ type: 'open', app: String(app) }),
  run: (app) => hopium.open(app),
  on: (event, fn) => { if (typeof fn === 'function') (__h[event] ||= []).push(fn); },
  once: (event, fn) => {
    if (typeof fn !== 'function') return;
    const wrapped = (...args) => {
      const handlers = __h[event] || [];
      __h[event] = handlers.filter((candidate) => candidate !== wrapped);
      fn(...args);
    };
    hopium.on(event, wrapped);
  },
  emit: (event, payload) => {
    for (const fn of __h[event] || []) {
      try { fn(payload); } catch (error) { console.error('[Hopium extension]', error); }
    }
  },
  storage: (() => {
    const memory = __storage.values;
    const readRaw = (key) => {
      const name = 'hopium:' + String(key);
      return memory.has(name) ? memory.get(name) : undefined;
    };
    const writeRaw = (key, raw) => {
      const name = 'hopium:' + String(key);
      if (raw == null) memory.delete(name);
      else memory.set(name, raw);
    };
    return {
      get: (key, fallback) => {
        const raw = readRaw(key);
        if (raw === undefined) return fallback;
        try { return JSON.parse(raw); } catch { return raw; }
      },
      set: (key, value) => {
        const raw = typeof value === 'string' ? value : JSON.stringify(value);
        writeRaw(key, raw);
        return value;
      },
      remove: (key) => { writeRaw(key, null); },
      clear: () => {
        for (const key of [...memory.keys()]) {
          if (key.startsWith('hopium:')) memory.delete(key);
        }
      }
    };
  })()
};
const __safeLocalStorage = __storage.safeStorage;
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  enumerable: true,
  get: () => __safeLocalStorage
});
Object.defineProperty(window, 'sessionStorage', {
  configurable: true,
  enumerable: true,
  get: () => __safeLocalStorage
});
Object.defineProperty(window, 'indexedDB', {
  configurable: true,
  enumerable: true,
  get: () => __safeIndexedDB
});
window.hopium = hopium;
window.unsafeWindow = window;
Object.defineProperty(window, 'unsafeWindow', {
  value: window,
  configurable: true,
  enumerable: false,
  writable: false
});
addEventListener('message', (event) => {
  if (event.data && event.data.type === 'click') hopium.emit('click', event.data);
});
`;
}

/** Match the useful subset of Chrome-style match patterns used by Hopium extensions. */
export function matchesExtensionPattern(pattern, rawUrl) {
	if (typeof pattern !== 'string' || typeof rawUrl !== 'string') return false;
	let url;
	try {
		url = new URL(rawUrl);
	} catch {
		return false;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
	if (pattern === '<all_urls>') return true;

	const match = /^(\*|https?):\/\/([^/]+)(\/.*)$/.exec(pattern.trim());
	if (!match) return false;
	const [, protocol, hostPattern, pathPattern] = match;
	if (protocol !== '*' && `${protocol}:` !== url.protocol) return false;

	const host = url.hostname.toLowerCase();
	const wantedHost = hostPattern.toLowerCase();
	if (wantedHost !== '*') {
		if (wantedHost.startsWith('*.')) {
			const base = wantedHost.slice(2);
			if (host !== base && !host.endsWith(`.${base}`)) return false;
		} else if (host !== wantedHost) {
			return false;
		}
	}

	const escapedPath = pathPattern
		.split('*')
		.map((part) => part.replace(/[|\\{}()[\]^$+?.]/g, '\\$&'))
		.join('.*');
	// URL fragments are not part of a browser extension match pattern.
	return new RegExp(`^${escapedPath}$`).test(`${url.pathname}${url.search}`);
}

function matchingScripts(extensions, url) {
	const result = [];
	for (const extension of extensions ?? []) {
		for (const [index, script] of (extension.contentScripts ?? []).entries()) {
			const patterns = Array.isArray(script.matches) ? script.matches : [];
			if (patterns.some((pattern) => matchesExtensionPattern(pattern, url))) {
				result.push({ extension, script, index });
			}
		}
	}
	return result;
}

/**
 * Apply enabled extension content scripts to a same-origin proxied page.
 * Scripts are user-installed code and intentionally run in the website's page world.
 */
export function applyBrowserExtensions(targetWindow, extensions, pageUrl) {
	if (!targetWindow?.document || !pageUrl) return;

	const doc = targetWindow.document;
	const cleanups = (targetWindow.__hopiumExtensionCleanups ??= new Map());
	const previousUrl = targetWindow.__hopiumExtensionPageUrl;
	if (previousUrl && previousUrl !== pageUrl) {
		for (const cleanup of cleanups.values()) {
			try {
				cleanup?.();
			} catch (error) {
				console.warn('Hopium extension cleanup failed:', error);
			}
		}
		cleanups.clear();
	}
	targetWindow.__hopiumExtensionPageUrl = pageUrl;
	const active = matchingScripts(extensions, pageUrl);
	const activeKeys = new Set(active.map(({ extension, index }) => `${extension.id}:${index}`));

	// Remove styles and returned cleanup functions for extensions that were switched off
	// or no longer match the current page.
	for (const [key, cleanup] of cleanups) {
		if (!activeKeys.has(key)) {
			try {
				cleanup?.();
			} catch (error) {
				console.warn('Hopium extension cleanup failed:', error);
			}
			cleanups.delete(key);
		}
	}
	for (const style of doc.querySelectorAll('style[data-hopium-extension]')) {
		if (!activeKeys.has(style.dataset.hopiumExtension)) style.remove();
	}

	for (const { extension, script, index } of active) {
		const key = `${extension.id}:${index}`;
		if (cleanups.has(key)) continue;

		if (typeof script.css === 'string' && script.css.trim()) {
			let style = [...doc.querySelectorAll('style[data-hopium-extension]')].find((node) => node.dataset.hopiumExtension === key);
			if (!style) {
				style = doc.createElement('style');
				style.dataset.hopiumExtension = key;
				style.textContent = script.css;
				(doc.head ?? doc.documentElement).appendChild(style);
			}
		}

		// Mark before executing. Inline script execution is synchronous in the target page.
		cleanups.set(key, null);
		if (typeof script.js === 'string' && script.js.trim()) {
			const element = doc.createElement('script');
			element.dataset.hopiumExtension = key;
			const label = String(extension.name).replace(/[\\'\n\r]/g, '');
			element.textContent = `(() => {\ntry {\nconst cleanup = (() => {\n${script.js}\n})();\nif (typeof cleanup === 'function') window.__hopiumExtensionCleanups?.set(${JSON.stringify(key)}, cleanup);\n} catch (error) { console.error('[Hopium extension: ${label}]', error); }\n})();`;
			(doc.head ?? doc.documentElement).appendChild(element);
			element.remove();
		}
	}
}
