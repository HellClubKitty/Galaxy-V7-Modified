# Hopium extensions

Hopium supports two extension formats:

- `.js` add-ons run in a sandboxed iframe and use the `hopium` API (`toast`, `notify`, `bar.set`, `bar.clear`, `on('click')`, `open`, `run`, and `storage.get/set/remove`).
- `.json` manifests can add content scripts to matching proxied websites. Content scripts can change the proxied page's DOM and styles.

## Browser content-script manifest

```json
{
  "name": "Example page tweak",
  "description": "Adds a style to example.com",
  "matches": ["https://example.com/*"],
  "contentScript": "document.documentElement.dataset.hopium = 'active';",
  "css": "body { outline: 2px solid #30d158; }"
}
```

Use `contentScripts` for more than one script:

```json
{
  "name": "Multi-site tweak",
  "contentScripts": [
    {
      "matches": ["https://example.com/*", "*://*.example.net/*"],
      "js": "document.documentElement.classList.add('my-extension');",
      "css": "body { font-family: sans-serif !important; }"
    }
  ]
}
```

Supported match patterns are `<all_urls>`, `https://host/path*`, `http://host/path*`, `*://host/path*`, and wildcard subdomains such as `https://*.example.com/*`. `js` and `css` are optional individually, but at least one is required per content script. The current iframe host applies them after the proxied document loads and re-evaluates matching on `pushState`, `replaceState`, back/forward, and hash navigation. A content script may return a cleanup function to undo page changes when it is disabled or stops matching.

**Security:** browser content scripts run in the proxied website's page context (not Chrome's isolated extension world). They can access and change that page's DOM and JavaScript environment. Only import manifests and scripts you trust. The older `.js` add-on format remains sandboxed and does not gain this page access.
