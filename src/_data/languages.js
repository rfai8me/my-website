import buildManifest from './buildManifest.js';
import { loadSiteConfiguration } from '../../lib/site-config.js';

const site = await loadSiteConfiguration();
const languages = new Set([site.site.defaultLanguage]);
for (const post of buildManifest.posts) {
  if (post.publicationState === 'published') languages.add(post.language);
}

export default [...languages].sort((left, right) => left.localeCompare(right));
