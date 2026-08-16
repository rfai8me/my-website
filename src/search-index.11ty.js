export default class SearchIndex {
  data() {
    return {
      permalink: '/search-index.json',
      eleventyExcludeFromCollections: true
    };
  }

  render({ buildManifest }) {
    const entries = buildManifest.posts
      .filter(({ publicationState }) => publicationState === 'published')
      .map((post) => ({
        id: post.id,
        language: post.language,
        title: post.frontmatter.title,
        description: post.frontmatter.description ?? null,
        tags: post.frontmatter.tags ?? [],
        url: post.pageUrl,
        body: post.body
      }));
    return `${JSON.stringify({ schemaVersion: 1, entries })}\n`;
  }
}
