import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/release-theme.yml', import.meta.url), 'utf8');
const pushScript = await readFile(new URL('../scripts/push.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('push validates, increments the theme artifact, and atomically publishes its commit and tag', () => {
  assert.equal(packageJson.scripts.push, 'node scripts/push.js');
  const testIndex = pushScript.indexOf("[npmExecutable, 'test']");
  const lintIndex = pushScript.indexOf("[npmExecutable, 'run', 'lint']");
  const versionIndex = pushScript.indexOf('manifest.themePackage.version = version');
  const configGuardIndex = pushScript.indexOf("config.getIn(['framework', 'themePackage', 'version']) !== current");
  const configVersionIndex = pushScript.indexOf("config.setIn(['framework', 'themePackage', 'version'], version)");
  const manifestWriteIndex = pushScript.indexOf('writeFileSync(manifestPath');
  const addIndex = pushScript.indexOf("['add', '.']");
  const commitIndex = pushScript.indexOf("['commit', '-m', commitMessage]");
  const tagIndex = pushScript.indexOf("['tag', tag]");
  const pushIndex = pushScript.indexOf("['push', '--atomic', 'origin', 'HEAD'");
  assert.ok([testIndex, lintIndex, versionIndex, configGuardIndex, configVersionIndex, manifestWriteIndex,
    addIndex, commitIndex, tagIndex, pushIndex]
    .every((index) => index >= 0));
  assert.ok(testIndex < lintIndex);
  assert.ok(lintIndex < versionIndex);
  assert.ok(versionIndex < configGuardIndex);
  assert.ok(configGuardIndex < configVersionIndex);
  assert.ok(configVersionIndex < manifestWriteIndex);
  assert.ok(manifestWriteIndex < addIndex);
  assert.ok(addIndex < commitIndex);
  assert.ok(commitIndex < tagIndex);
  assert.ok(tagIndex < pushIndex);
  assert.match(pushScript, /const tag = `theme-v\$\{version\}`/);
});

test('push requires exactly one non-empty commit message before changing the theme version', () => {
  for (const args of [[], [''], ['one', 'two']]) {
    const result = spawnSync(process.execPath, ['scripts/push.js', ...args], {
      encoding: 'utf8',
      shell: false
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: npm run push -- "commit message"/);
  }
});

test('theme release uses trusted publishing from an exact tag-matched staged artifact', () => {
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /environment: npm-theme-release/);
  assert.match(workflow, /npm@11\.19\.0/);
  assert.match(workflow, /node scripts\/stage-theme-package\.js/);
  assert.match(workflow, /test "\$actual" = "\$expected"/);
  assert.match(workflow, /npm publish "\$staging" --access public --provenance/);
  assert.doesNotMatch(workflow, /NODE_AUTH_TOKEN|NPM_TOKEN|secrets\./);
});

test('every third-party action is immutable commit pinned', () => {
  const uses = [...workflow.matchAll(/^\s*uses:\s*(\S+)/gm)].map((match) => match[1]);
  assert.ok(uses.length > 0);
  assert.ok(uses.every((value) => /@[0-9a-f]{40}$/.test(value)));
});
