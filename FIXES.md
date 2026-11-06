# Proxy and extension fixes

## Scramjet / service worker

- All browser routes now use one shared service-worker initializer.
- Initialization waits for service-worker activation and page control before the proxy controller is initialized or a proxied URL is assigned.
- Failed initialization can be retried instead of leaving a permanent `registered` flag behind.
- The service worker only calls the legacy Scramjet router after a saved configuration is available; ordinary requests pass through on a fresh install.
- Prism transport switching avoids rebuilding the transport when the selected transport and Wisp endpoint have not changed.
- Scramjet v2 proxy requests wait briefly for controller re-registration after a service-worker cold start instead of falling through to Fastify's static `/prism/` handler and returning 404.
- Worker-restart notifications can force a route-table rebuild even during the controller's initial startup guard, and controllers attach to the new worker after `controllerchange`.
- Large inline `data:` resources still use Scramjet's virtual `/prism/` route; that route is now covered by the same cold-start recovery.

## Browser extensions

- Existing `.js` OS add-ons retain their sandboxed `hopium` API.
- JSON manifests can install website content scripts with URL match patterns, JavaScript, and CSS.
- Content scripts apply to matching proxied tabs and are re-evaluated after common single-page-app navigation events.
- Returned cleanup functions run when an extension is disabled or the page stops matching.

Browser content scripts execute in the proxied page's JavaScript context, not in a browser-native isolated extension world. They can access and modify that page, so only install code you trust.

## Verification

Run `npm test` for the Node regression tests. The current patch passes all 20 tests. `npm run check` / `npm run build` still need to be run in an environment with the project dependencies installed; dependency installation timed out in the patching environment.

## Browser settings menu

- Fixed the three-dot settings dropdown's render crash: the old markup called an unimported Character.AI URL helper.
- Removed the Character.AI-specific transport notice from the browser menu.
- The settings trigger now exposes its expanded state to assistive technology, and the backdrop closes the dropdown deterministically.
- The Wisp settings now show the effective endpoint, including the default `wss://<current-host>/lively/` endpoint when no custom server is configured.
- The menu closes competing popovers before opening, avoiding stacked overlays that can intercept clicks.

## Character.AI chat compatibility

- Scramjet routes proxied WebSocket connections through its selected transport.
- Character.AI's chat uses a WebSocket on `neo.character.ai`; the browser selects Epoxy as soon as navigation to Character.AI is requested, before iframe `load` fires. This avoids an early fallback to Libcurl while the page starts.
- Scramjet now scopes WebSocket cookies to the WebSocket destination host and path, rather than the top-level document URL. The WebSocketStream hook follows the same destination-aware rule.
- Other websites retain the configured transport. The browser's Transport setting remains the general preference and is restored when no Character.AI tab is open.
- A `403 != 101` still means the destination or an intermediary refused the WebSocket upgrade. These client-side fixes address transport timing and cookie-scope bugs, but an authenticated live Character.AI session is still needed to prove whether the remaining denial is upstream security filtering.
