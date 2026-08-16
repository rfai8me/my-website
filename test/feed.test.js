import assert from 'node:assert/strict';
import test from 'node:test';

import LanguageFeeds from '../src/feed.11ty.js';

test('language feeds contain only the newest 20 published variants in deterministic order', () => {
  const originalBuildInstant = process.env.GALA_BUILD_INSTANT;
  process.env.GALA_BUILD_INSTANT = '2026-06-30T12:00:00Z';
  try {
    const posts = Array.from({ length: 22 }, (_, index) => ({
      id: `01K000000000000000000000${String(index).padStart(2, '0')}`,
      language: 'en',
      publicationState: 'published',
      canonicalUrl: `https://example.com/en/post-${index}/`,
      body: `Post ${index}`,
      frontmatter: {
        title: `Post ${index}`,
        publishAfterDate: `2026-06-${String(index + 1).padStart(2, '0')}`
      }
    }));
    posts.push({
      ...posts[21],
      id: '01K00000000000000000000099',
      publicationState: 'tombstoned',
      frontmatter: { ...posts[21].frontmatter, title: 'Tombstoned' }
    });
    posts.push({
      ...posts[21],
      id: '01K00000000000000000000098',
      language: 'fr',
      frontmatter: { ...posts[21].frontmatter, title: 'French' }
    });

    const feed = new LanguageFeeds().render({
      buildManifest: { posts },
      language: 'en',
      site: {
        site: { name: 'Fixture' },
        hosting: { canonicalBaseUrl: 'https://example.com', pathPrefix: '/' }
      }
    });

    assert.equal((feed.match(/<entry>/g) ?? []).length, 20);
    assert.match(feed, /<updated>2026-06-30T12:00:00\.000Z<\/updated>/);
    assert.ok(feed.indexOf('Post 21') < feed.indexOf('Post 20'));
    assert.doesNotMatch(feed, /Post 0|Post 1<\/title>|Tombstoned|French/);
  } finally {
    if (originalBuildInstant == null) delete process.env.GALA_BUILD_INSTANT;
    else process.env.GALA_BUILD_INSTANT = originalBuildInstant;
  }
});
