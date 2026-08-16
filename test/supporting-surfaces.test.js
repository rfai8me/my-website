import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('provides a static 404 page', async () => {
  const source = await readFile(new URL('../src/404.njk', import.meta.url), 'utf8');
  assert.match(source, /permalink: \/404\.html/);
  assert.match(source, /Page not found/);
});

test('share copy uses clipboard only in secure contexts and exposes fallback', async () => {
  const source = await readFile(new URL('../src/assets/interactions.js', import.meta.url), 'utf8');
  assert.match(source, /window\.isSecureContext/);
  assert.match(source, /navigator\.clipboard\?\.writeText/);
  assert.match(source, /selectableFallback/);
  assert.match(source, /fallback\?\.select\(\)/);
});

test('code blocks receive an accessible progressive copy control', async () => {
  const source = await readFile(new URL('../src/assets/interactions.js', import.meta.url), 'utf8');
  assert.match(source, /querySelectorAll\('pre code'\)/);
  assert.match(source, /dataset\.copyCode/);
  assert.match(source, /Copy code block/);
});
