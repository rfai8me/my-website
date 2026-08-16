import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const behavior = await readFile(new URL('../src/assets/interactions.js', import.meta.url), 'utf8');
const components = await readFile(new URL('../src/_includes/components/ui.njk', import.meta.url), 'utf8');

test('published article islands request the neutral public bundle without credentials', () => {
  assert.match(components, /data-engagement-url=/);
  assert.match(components, /\/v1\/articles\/.*\/engagement/);
  assert.match(behavior, /querySelectorAll\('\[data-engagement-url\]'\)/);
  assert.match(behavior, /new URL\(region\.dataset\.engagementUrl\)/);
  assert.match(behavior, /fetch\(requestUrl/);
  assert.match(behavior, /credentials: 'omit'/);
  assert.match(behavior, /headers: \{ Accept: 'application\/json' \}/);
});

test('comment cursors append nested thread pages without navigating', () => {
  assert.match(behavior, /requestUrl\.searchParams\.set\('commentsCursor', commentsCursor\)/);
  assert.match(behavior, /data-comments-cursor/);
  assert.match(behavior, /refreshEngagement\(region, moreComments\.dataset\.commentsCursor, true\)/);
  assert.match(behavior, /comment\.parentCommentId/);
  assert.match(behavior, /gala-comment-replies/);
});

test('live engagement renders untrusted API fields only through textContent', () => {
  assert.match(behavior, /textContent = text/);
  assert.match(behavior, /data\.profile\.displayName/);
  assert.match(behavior, /comment\.author\?\.displayName/);
  assert.doesNotMatch(behavior, /innerHTML|insertAdjacentHTML|document\.write/);
});

test('published articles send one best-effort privacy-reduced view beacon', () => {
  assert.match(behavior, /replace\(\/\\\/engagement\$\/, '\/views'\)/);
  assert.match(behavior, /method: 'POST'/);
  assert.match(behavior, /keepalive: true/);
  assert.match(behavior, /document\.documentElement\.lang/);
  assert.match(behavior, /document\.referrer/);
  assert.match(behavior, /\['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'\]/);
  assert.match(behavior, /\.catch\(\(\) => \{\}\)/);
});

test('live totals use the aggregate comment count rather than first-page length', () => {
  const context = {
    URL,
    window: { addEventListener() {}, isSecureContext: true, location: { href: 'https://example.com/' } },
    navigator: {},
    document: {
      addEventListener() {},
      querySelectorAll() { return []; },
      querySelector() { return null; }
    },
    Set
  };
  vm.runInNewContext(behavior, context);
  const counts = context.engagementCounts({
    reactions: { LIKE: 3 },
    comments: { items: Array.from({ length: 20 }), totalCount: 41 },
    views: { count: 7 }
  });

  assert.deepEqual(Array.from(counts, (entry) => Array.from(entry)), [
    ['Reactions', 3], ['Comments', 41], ['Views', 7]
  ]);
});

test('authenticated writes use only the typed platform-frame protocol', () => {
  for (const operation of [
    'comment.create', 'comment.edit', 'comment.delete',
    'reaction.add', 'reaction.remove', 'follow.add', 'follow.remove'
  ]) {
    assert.match(behavior, new RegExp(operation.replace('.', '\\.')));
  }
  assert.match(behavior, /type: 'gala-engagement-write', requestId, operation, payload/);
  assert.match(behavior, /event\.origin !== sessionOrigin/);
  assert.match(behavior, /event\.source !== sessionFrame\.contentWindow/);
  assert.match(behavior, /event\.data\?\.type === 'gala-engagement-result'/);
  assert.match(behavior, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(behavior, /Authorization|Bearer|gala-reader-session|localStorage/);
});

test('reader controls are accessible and include all low-risk write classes', () => {
  assert.match(components, /data-comment-create/);
  assert.match(components, /maxlength="5000" required/);
  assert.match(components, /data-follow-article aria-pressed="false"/);
  assert.match(components, /\['like', 'love', 'insightful', 'curious', 'celebrate', 'support'\]/);
  assert.match(components, /data-reaction="{{ reaction }}"/);
  assert.match(behavior, /data-reply-comment/);
  assert.match(behavior, /data-edit-comment/);
  assert.match(behavior, /data-delete-comment/);
  assert.match(behavior, /textContent = engagementErrorMessage/);
});
