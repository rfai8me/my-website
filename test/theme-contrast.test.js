import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../src/assets/theme.css', import.meta.url), 'utf8');

function rgb(hex) {
  const expanded = hex.length === 4
    ? `#${[...hex.slice(1)].map((digit) => digit.repeat(2)).join('')}`
    : hex;
  return [1, 3, 5].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  const [red, green, blue] = rgb(hex).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(left, right) {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function explicitModeTokens(mode, palette = null) {
  const selector = palette == null
    ? `:root\\[data-mode='${mode}'\\]`
    : `:root\\[data-palette='${palette}'\\]\\[data-mode='${mode}'\\]`;
  const block = css.match(new RegExp(`${selector} \\{([^}]+)\\}`))?.[1];
  assert.ok(block, `missing ${palette ?? 'default'} ${mode} token block`);
  return Object.fromEntries(
    [...block.matchAll(/--gala-color-([a-z]+):\s*(#[0-9a-f]+);/gi)]
      .map((match) => [match[1], match[2]])
  );
}

test('default palette meets WCAG AA contrast in explicit light and dark modes', () => {
  for (const mode of ['light', 'dark']) {
    const tokens = explicitModeTokens(mode);
    assert.ok(contrast(tokens.text, tokens.background) >= 4.5, `${mode} body text contrast`);
    assert.ok(contrast(tokens.text, tokens.surface) >= 4.5, `${mode} surface text contrast`);
    assert.ok(contrast(tokens.accent, tokens.background) >= 4.5, `${mode} link contrast`);
    assert.ok(contrast(tokens.border, tokens.background) >= 3, `${mode} control boundary contrast`);
  }
});

test('ocean palette meets WCAG AA contrast in explicit light and dark modes', () => {
  for (const mode of ['light', 'dark']) {
    const tokens = explicitModeTokens(mode, 'ocean');
    assert.ok(contrast(tokens.text, tokens.background) >= 4.5, `${mode} body text contrast`);
    assert.ok(contrast(tokens.text, tokens.surface) >= 4.5, `${mode} surface text contrast`);
    assert.ok(contrast(tokens.accent, tokens.background) >= 4.5, `${mode} link contrast`);
    assert.ok(contrast(tokens.border, tokens.background) >= 3, `${mode} control boundary contrast`);
  }
});
