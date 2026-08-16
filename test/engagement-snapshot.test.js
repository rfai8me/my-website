import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  EMPTY_ENGAGEMENT,
  engagementFor,
  readEngagementSnapshot
} from '../lib/engagement-snapshot.js';

test('missing snapshot produces placeholders without a network fallback', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gala-snapshot-'));
  const snapshot = await readEngagementSnapshot(path.join(root, '.engagement-snapshot.json'));
  assert.strictEqual(engagementFor(snapshot, '01K00000000000000000000000'), EMPTY_ENGAGEMENT);
});

test('reads non-negative committed counts', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gala-snapshot-'));
  const file = path.join(root, '.engagement-snapshot.json');
  await writeFile(file, JSON.stringify({
    schemaVersion: 1,
    refreshedAt: '2026-06-15T00:00:00Z',
    articles: {
      '01K00000000000000000000000': { reactions: 2, comments: 3, views: 5 }
    }
  }));
  const entry = engagementFor(await readEngagementSnapshot(file), '01K00000000000000000000000');
  assert.deepEqual(entry, { available: true, reactions: 2, comments: 3, views: 5 });
});

test('rejects malformed schema and fabricated negative counts', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gala-snapshot-'));
  const file = path.join(root, '.engagement-snapshot.json');
  await writeFile(file, '{"schemaVersion":2,"articles":{}}');
  await assert.rejects(() => readEngagementSnapshot(file), /Unsupported/);
  assert.throws(
    () => engagementFor({ articles: { id: { reactions: -1, comments: 0, views: 0 } } }, 'id'),
    /Invalid reactions/
  );
});
