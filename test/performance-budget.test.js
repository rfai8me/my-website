import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { enforcePerformanceBudgets } from '../lib/performance-budget.js';

const BUDGETS = {
  managedJavaScriptBytes: 32_768,
  managedCssBytes: 16_384,
  ordinaryHtmlBytes: 32_768
};

async function outputFixture() {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), 'gala-performance-budget-'));
  await mkdir(path.join(outputDirectory, 'assets'));
  await mkdir(path.join(outputDirectory, 'en', 'post'), { recursive: true });
  await writeFile(path.join(outputDirectory, 'assets', 'theme.js'), 'j'.repeat(100));
  await writeFile(path.join(outputDirectory, 'assets', 'theme.css'), 'c'.repeat(100));
  await writeFile(path.join(outputDirectory, 'en', 'post', 'index.html'), 'h'.repeat(100));
  await writeFile(path.join(outputDirectory, 'authored-media.bin'), 'm'.repeat(100_000));
  await writeFile(path.join(outputDirectory, 'custom.css'), 'a'.repeat(100_000));
  return outputDirectory;
}

test('enforces uncompressed managed assets and ordinary HTML only', async () => {
  const outputDirectory = await outputFixture();
  assert.deepEqual(
    await enforcePerformanceBudgets({ outputDirectory, budgets: BUDGETS }),
    { javascriptBytes: 100, cssBytes: 100 }
  );
});

for (const [name, file, bytes, expected] of [
  ['JavaScript', ['assets', 'theme.js'], 32_769, /Managed JavaScript.*32769 bytes > 32768 bytes/],
  ['CSS', ['assets', 'theme.css'], 16_385, /Managed CSS.*16385 bytes > 16384 bytes/],
  ['HTML', ['en', 'post', 'index.html'], 32_769, /en\/post\/index\.html.*32769 bytes > 32768 bytes/]
]) {
  test(`fails closed when ${name} exceeds its byte budget`, async () => {
    const outputDirectory = await outputFixture();
    await writeFile(path.join(outputDirectory, ...file), 'x'.repeat(bytes));
    await assert.rejects(
      () => enforcePerformanceBudgets({ outputDirectory, budgets: BUDGETS }),
      expected
    );
  });
}
