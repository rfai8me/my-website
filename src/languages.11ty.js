import { siteUrl } from '../lib/seo.js';

function html(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export default class LanguageIndexes {
  data() {
    return {
      pagination: { data: 'languages', size: 1, alias: 'language' },
      layout: 'layouts/base.njk',
      permalink: ({ language }) => `/${language}/index.html`,
      eleventyComputed: {
        title: ({ language }) => language
      }
    };
  }

  render({ buildManifest, language, site }) {
    const posts = buildManifest.posts.filter(
      (post) => post.publicationState === 'published' && post.language === language
    );
    const items = posts.map((post) => {
      const href = siteUrl({
        canonicalBaseUrl: site.hosting.canonicalBaseUrl,
        pathPrefix: site.hosting.pathPrefix ?? '/',
        relativePath: post.relativeUrl
      });
      return `<li><a href="${html(href)}">${html(post.frontmatter.title)}</a></li>`;
    }).join('');
    return `<h1>${html(site.site.name)} — ${html(language)}</h1><ol>${items}</ol>`;
  }
}
