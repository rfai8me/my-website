import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/assets/theme-mode.js', import.meta.url), 'utf8');

function browserHarness(initialValue, { storageThrows = false } = {}) {
  const values = new Map(initialValue == null ? [] : [['gala-color-mode', initialValue]]);
  const listeners = {};
  const control = {
    attributes: {},
    textContent: '',
    addEventListener(type, listener) { listeners[type] = listener; },
    setAttribute(name, value) { this.attributes[name] = value; },
    querySelector() { return null; }
  };
  let ready;
  const context = {
    document: {
      documentElement: { dataset: { mode: 'system' } },
      addEventListener(type, listener) {
        assert.equal(type, 'DOMContentLoaded');
        ready = listener;
      },
      querySelectorAll(selector) {
        assert.equal(selector, '[data-theme-mode-toggle]');
        return [control];
      }
    },
    localStorage: {
      getItem(key) {
        if (storageThrows) throw new Error('storage unavailable');
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        if (storageThrows) throw new Error('storage unavailable');
        values.set(key, value);
      }
    }
  };
  vm.runInNewContext(source, context);
  ready();
  return { context, control, listeners, values };
}

test('applies stored mode and exposes current and next mode accessibly', () => {
  const harness = browserHarness('dark');
  assert.equal(harness.context.document.documentElement.dataset.mode, 'dark');
  assert.equal(harness.control.textContent, 'Theme: dark');
  assert.equal(harness.control.attributes['aria-label'], 'Color mode: dark. Activate for system.');

  harness.listeners.click();
  assert.equal(harness.context.document.documentElement.dataset.mode, 'system');
  assert.equal(harness.values.get('gala-color-mode'), 'system');
  assert.equal(harness.control.attributes['aria-label'], 'Color mode: system. Activate for light.');
});

test('invalid or unavailable storage safely resolves to system mode', () => {
  for (const harness of [browserHarness('sepia'), browserHarness(null, { storageThrows: true })]) {
    assert.equal(harness.context.document.documentElement.dataset.mode, 'system');
    assert.equal(harness.control.textContent, 'Theme: system');
    assert.doesNotThrow(() => harness.listeners.click());
    assert.equal(harness.context.document.documentElement.dataset.mode, 'light');
  }
});
