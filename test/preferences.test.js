import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/assets/preferences.js', import.meta.url), 'utf8');

function harness(stored = null, { navigate = true, storageThrows = false } = {}) {
  const values = new Map(stored == null ? [] : [['gala-language-preference', stored]]);
  const listeners = {};
  const options = [
    { value: 'en', dataset: { url: 'https://example.com/en/post/' } },
    { value: 'fr', dataset: { url: 'https://example.com/fr/post/' } }
  ];
  const control = {
    options,
    value: 'en',
    addEventListener(type, listener) { listeners[type] = listener; },
    hasAttribute(name) { return navigate && name === 'data-navigate-on-selection'; }
  };
  const navigations = [];
  let ready;
  const context = {
    document: {
      addEventListener(_type, listener) { ready = listener; },
      querySelectorAll() { return [control]; }
    },
    localStorage: {
      getItem(key) {
        if (storageThrows) throw new Error('unavailable');
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        if (storageThrows) throw new Error('unavailable');
        values.set(key, value);
      }
    },
    window: { location: { assign(url) { navigations.push(url); } } }
  };
  vm.runInNewContext(source, context);
  ready();
  return { control, listeners, navigations, values };
}

test('stored language only highlights an option and never redirects during initialization', () => {
  const result = harness('fr');
  assert.equal(result.control.value, 'fr');
  assert.deepEqual(result.navigations, []);
});

test('explicit switcher selection stores preference and performs user-initiated navigation', () => {
  const result = harness('en');
  result.control.value = 'fr';
  result.listeners.change();
  assert.equal(result.values.get('gala-language-preference'), 'fr');
  assert.deepEqual(result.navigations, ['https://example.com/fr/post/']);
});

test('settings selection never navigates and unavailable storage does not break selection', () => {
  const result = harness(null, { navigate: false, storageThrows: true });
  result.control.value = 'fr';
  assert.doesNotThrow(() => result.listeners.change());
  assert.deepEqual(result.navigations, []);
});
