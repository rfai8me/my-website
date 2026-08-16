import { readEngagementSnapshot } from '../../lib/engagement-snapshot.js';

export default await readEngagementSnapshot(
  new URL('../../.engagement-snapshot.json', import.meta.url)
);
