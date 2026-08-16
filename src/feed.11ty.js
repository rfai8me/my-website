import { markdownLibrary } from '../lib/render-markdown.js';
import { renderAtomFeed, siteUrl, sortFeedPosts } from '../lib/seo.js';

function feedUpdated() {
  const configured = process.env.GALA_BUILD_INSTANT;
  const instant = configured == null ? new Date() : new Date(configured);
  if (Number.isNaN(instant.getTime())) throw new TypeError('GALA_BUILD_INSTANT must be an ISO instant');
  return instant.toISOString();
}

export default class LanguageFeeds {
  data() {
    return {
      pagination: { data: 'languages', size: 1, alias: 'language' },
      permalink: ({ language }) => `/feed/${language}.xml`,
      eleventyExcludeFromCollections: true
    };
  }

  render({ buildManifest, language, site }) {
    const posts = sortFeedPosts(buildManifest.posts.filter(
      (post) => post.publicationState === 'published' && post.language === language
    )).slice(0, 20);
    const selfUrl = siteUrl({
      canonicalBaseUrl: site.hosting.canonicalBaseUrl,
      pathPrefix: site.hosting.pathPrefix ?? '/',
      relativePath: `/feed/${language}.xml`
    });
    return renderAtomFeed({
      id: selfUrl,
      title: `${site.site.name} — ${language}`,
      author: typeof site.site.author === 'string' && site.site.author.trim() !== ''
        ? site.site.author.trim()
        : site.site.name,
      updated: feedUpdated(),
      selfUrl,
      entries: posts.map((post) => ({
        id: `urn:gala:article:${post.id}:${post.language}`,
        title: post.frontmatter.title,
        updated: `${post.frontmatter.publishAfterDate}T00:00:00.000Z`,
        url: post.canonicalUrl,
        html: markdownLibrary.render(post.body)
      }))
    });
  }
}
