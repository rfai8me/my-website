import { articleHreflang, renderSitemap } from '../lib/seo.js';

export default class Sitemap {
  data() {
    return { permalink: '/sitemap.xml' };
  }

  render({ buildManifest, site }) {
    const published = buildManifest.posts.filter(
      ({ publicationState }) => publicationState === 'published'
    );
    const hreflang = articleHreflang(published, site);
    return renderSitemap(published.map((post) => {
      const links = hreflang.get(post.source);
      return {
        url: post.pageUrl,
        lastModified: post.frontmatter.editHistory?.at(-1)?.slice(0, 10)
          ?? post.frontmatter.publishAfterDate,
        variants: links
          .filter(({ hreflang: language }) => language !== 'x-default')
          .map(({ hreflang: language, href: url }) => ({ language, url })),
        xDefaultUrl: links.find(({ hreflang: language }) => language === 'x-default').href
      };
    }));
  }
}
