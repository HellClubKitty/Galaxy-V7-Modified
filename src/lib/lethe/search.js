const engines = {
	ddg: 'https://duckduckgo.com/?q=%s',
	google: 'https://www.google.com/search?q=%s',
	brave: 'https://search.brave.com/search?q=%s'
};

// "example.com", "sub.example.co.uk/path?x=1", "localhost:3000" or an IPv4 address, with no spaces
const looksLikeHost = /^(?:localhost|(?:[a-z0-9-]+\.)+[a-z]{2,}|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:[/?#]\S*)?$/i;

/** Turns whatever was typed into the address bar into a navigable http(s) URL. */
export function search(input, engine = 'ddg') {
	const text = String(input ?? '').trim();
	if (/^https?:\/\/\S+$/i.test(text)) {
		try {
			return new URL(text).toString();
		} catch {}
	}
	if (looksLikeHost.test(text)) {
		try {
			return new URL(`https://${text}`).toString();
		} catch {}
	}
	return (engines[engine] ?? engines.ddg).replace('%s', encodeURIComponent(text));
}
