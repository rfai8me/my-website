function html(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export default class PublishedSlugRedirects {
  data() {
    return {
      pagination: {
        data: 'buildManifest.redirects',
        size: 1,
        alias: 'redirect'
      },
      permalink: ({ redirect }) => `${redirect.relativeUrl}index.html`,
      eleventyExcludeFromCollections: true
    };
  }

  render({ redirect }) {
    const target = html(redirect.targetUrl);
    return `<!doctype html>
<html lang="${html(redirect.language)}">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url=${target}">
    <link rel="canonical" href="${target}">
    <title>Post moved</title>
  </head>
  <body><p>This post moved to <a href="${target}">${target}</a>.</p></body>
</html>
`;
  }
}
