import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { resolveShareTargets } from '../lib/share-targets.js';

test('renders every verified provider with encoded canonical inputs', () => {
  const targets = resolveShareTargets({
    configured: ['x', 'bluesky', 'linkedin', 'whatsapp', 'hacker-news', 'email', 'mastodon'],
    title: 'Gala & safety',
    canonicalUrl: 'https://author.example/en/post/?a=1&b=2',
    socialProfiles: { mastodon: 'https://social.example/@author' }
  });
  assert.deepEqual(targets.map(({ provider }) => provider),
    ['x', 'bluesky', 'linkedin', 'whatsapp', 'hacker-news', 'email', 'mastodon']);
  for (const target of targets) {
    assert.ok(target.label);
    assert.match(target.url, /^(?:https:|mailto:)/);
    assert.doesNotMatch(target.url, /\{[^}]+\}/);
  }
  assert.match(targets[0].url, /text=Gala(?:%20|\+)%26(?:%20|\+)safety/);
  assert.match(targets[0].url, /url=https%3A%2F%2Fauthor\.example%2Fen%2Fpost%2F%3Fa%3D1%26b%3D2/);
  assert.match(targets[2].url, /^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=/);
  assert.match(targets[3].url, /^https:\/\/wa\.me\/\?text=Gala/);
  assert.match(targets[6].url, /^https:\/\/social\.example\/share\?/);
});

test('rejects unverified providers and missing Mastodon instance', () => {
  const base = { title: 'Post', canonicalUrl: 'https://author.example/en/post/' };
  assert.throws(() => resolveShareTargets({ ...base, configured: ['reddit'] }), /no verified/);
  assert.throws(() => resolveShareTargets({ ...base, configured: ['mastodon'] }), /socialProfiles\.mastodon/);
});

test('runtime fixture is a self-contained, sourced provider contract', async () => {
  const fixture = JSON.parse(await readFile(
    new URL('../lib/provider-fixtures/share-intents.v1.json', import.meta.url),
    'utf8'
  ));
  assert.equal(fixture.schemaVersion, 1);
  for (const [provider, contract] of Object.entries(fixture.providers)) {
    assert.match(contract.source, /^https:\/\//, `${provider} must cite an HTTPS source`);
    if (contract.status === 'verified') {
      assert.match(contract.verifiedOn, /^\d{4}-\d{2}-\d{2}$/, `${provider} must record verification date`);
      assert.equal(typeof contract.template, 'string', `${provider} must define an intent template`);
    } else {
      assert.equal(contract.status, 'blocked-public-intent-contract-unverified');
      assert.equal(Object.hasOwn(contract, 'template'), false);
    }
  }
});
