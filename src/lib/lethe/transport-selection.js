/** Return true for Character.AI origins, including beta/www subdomains. */
export function isCharacterAiUrl(rawUrl) {
	try {
		const hostname = new URL(rawUrl).hostname.toLowerCase();
		return hostname === 'character.ai' || hostname.endsWith('.character.ai');
	} catch {
		return false;
	}
}

/**
 * Character.AI's chat frontend uses a WebSocket on neo.character.ai. Prefer Epoxy
 * for Character.AI origins, and retain the user's configured transport elsewhere.
 */
export function preferredPrismTransport(rawUrl, fallback = 'libcurl') {
	if (isCharacterAiUrl(rawUrl)) return 'epoxy';
	return fallback === 'epoxy' ? 'epoxy' : 'libcurl';
}

/** True while any open browser tab is loading or displaying Character.AI. */
export function hasCharacterAiFrame(frames) {
	return Array.isArray(frames) && frames.some((frame) =>
		isCharacterAiUrl(frame?.transportUrl || frame?.displayUrl || '')
	);
}
