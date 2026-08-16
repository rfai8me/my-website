import { siteUrl } from '../../lib/seo.js';
import { loadSiteConfiguration } from '../../lib/site-config.js';
import languages from './languages.js';

const site = await loadSiteConfiguration();

export default languages.map((language) => Object.freeze({
  language,
  title: `${site.site.name} — ${language}`,
  href: siteUrl({
    canonicalBaseUrl: site.hosting.canonicalBaseUrl,
    pathPrefix: site.hosting.pathPrefix ?? '/',
    relativePath: `/feed/${language}.xml`
  })
}));
