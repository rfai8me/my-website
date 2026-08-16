import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('client search uses the generated index and renders untrusted fields as text', async () => {
  const source = await readFile(new URL('../src/assets/search.js', import.meta.url), 'utf8');
  assert.match(source, /fetch\(indexUrl/);
  assert.match(source, /querySelectorAll\('\[data-gala-search\]'\)/);
  assert.match(source, /URLSearchParams/);
  assert.match(source, /textContent/);
  assert.match(source, /createElement\('a'\)/);
  assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|document\.write/);
});
