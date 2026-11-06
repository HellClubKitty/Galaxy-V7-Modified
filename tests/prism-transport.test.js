import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isCharacterAiUrl, preferredPrismTransport, hasCharacterAiFrame } from '../src/lib/lethe/transport-selection.js';

test('recognizes Character.AI and its subdomains', () => {
  assert.equal(isCharacterAiUrl('https://character.ai/chat/abc'), true);
  assert.equal(isCharacterAiUrl('https://www.character.ai/chat/abc'), true);
  assert.equal(isCharacterAiUrl('https://beta.character.ai/chat2'), true);
  assert.equal(isCharacterAiUrl('https://character.ai.example.org/'), false);
  assert.equal(isCharacterAiUrl('not a url'), false);
});

test('Character.AI uses Epoxy for its WebSocket chat connection', () => {
  assert.equal(preferredPrismTransport('https://character.ai/chat/abc', 'libcurl'), 'epoxy');
  assert.equal(preferredPrismTransport('https://www.character.ai/chat/abc', 'libcurl'), 'epoxy');
  assert.equal(preferredPrismTransport('https://beta.character.ai/chat2', 'libcurl'), 'epoxy');
});

test('other websites keep the configured transport', () => {
  assert.equal(preferredPrismTransport('https://example.com', 'libcurl'), 'libcurl');
  assert.equal(preferredPrismTransport('https://example.com', 'epoxy'), 'epoxy');
});

test('invalid URLs do not change the configured transport', () => {
  assert.equal(preferredPrismTransport('', 'libcurl'), 'libcurl');
  assert.equal(preferredPrismTransport('not a url', 'epoxy'), 'epoxy');
});


test('pending Character.AI navigation selects Epoxy before iframe onload', () => {
  const frames = [{ displayUrl: '', transportUrl: 'https://character.ai/chat2?char=abc' }];
  assert.equal(hasCharacterAiFrame(frames), true);
  assert.equal(hasCharacterAiFrame([{ displayUrl: 'https://example.com', transportUrl: 'https://example.com' }]), false);
});

test('WebSocket cookies are scoped to the WebSocket destination', () => {
  const bundle = readFileSync(new URL('../prism/prism.js', import.meta.url), 'utf8');
  assert.match(bundle, /getCookies\(s, !1\)/);
  assert.match(bundle, /getCookies\(n, !1\)/);
  assert.doesNotMatch(bundle, /getCookies\(e\.url, !1\)/);
});
