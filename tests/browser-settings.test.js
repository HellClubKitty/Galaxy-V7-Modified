import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/routes/slate/+page.svelte', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/lib/style/browser.css', import.meta.url), 'utf8');

test('three-dot browser settings trigger has an accessible, controlled dropdown', () => {
  assert.match(page, /aria-label="Browser settings"/);
  assert.match(page, /aria-expanded=\{settingsOpen\}/);
  assert.match(page, /aria-controls="browser-settings-dropdown"/);
  assert.match(page, /id="browser-settings-dropdown"/);
  assert.match(page, /onclick=\{\(event\) => \{ event\.stopPropagation\(\); toggleSettings\(\); \}\}/);
});

test('settings dropdown closes without toggling back open when its overlay is clicked', () => {
  assert.match(page, /function closeSettings\(\) \{\s*settingsOpen = false;/);
  assert.match(page, /class="settings-overlay" onclick=\{closeSettings\}/);
});

test('settings menu no longer references the missing Character.AI helper or displays its notice', () => {
  assert.doesNotMatch(page, /isCharacterAiUrl/);
  assert.doesNotMatch(page, /Character\.AI automatically uses Epox/);
});

test('settings menu displays the effective Wisp endpoint, including the default endpoint', () => {
  assert.match(page, /defaultWispUrl = getWispUrl\(\)/);
  assert.match(page, /let activeWispUrl = \$derived\(customWisp \|\| defaultWispUrl/);
  assert.match(page, /<span>Active server<\/span>/);
  assert.match(page, /<code>\{activeWispUrl\}<\/code>/);
  assert.match(styles, /\.active-server code/);
});
