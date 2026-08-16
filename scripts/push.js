import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseDocument } from 'yaml';

const messages = process.argv.slice(2);
if (messages.length !== 1 || messages[0].trim() === '') {
  throw new Error('Usage: npm run push -- "commit message"');
}

const npmExecutable = process.env.npm_execpath;
if (npmExecutable == null || npmExecutable.trim() === '') {
  throw new Error('npm run push must be invoked through npm');
}

function execute(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

execute(process.execPath, [npmExecutable, 'test']);
execute(process.execPath, [npmExecutable, 'run', 'lint']);

const manifestPath = '.gala/managed-files.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const current = manifest.themePackage?.version;
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current ?? '');
if (match == null) throw new Error('Theme package version must be canonical SemVer');
const version = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
manifest.themePackage.version = version;

const configPath = 'site.config.yml';
const config = parseDocument(readFileSync(configPath, 'utf8'));
if (config.errors.length !== 0
    || config.getIn(['framework', 'themePackage', 'name']) !== manifest.themePackage.name
    || config.getIn(['framework', 'themePackage', 'version']) !== current) {
  throw new Error('site.config.yml theme identity must match the managed manifest before release');
}
config.setIn(['framework', 'themePackage', 'version'], version);

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'w' });
writeFileSync(configPath, config.toString(), { flag: 'w' });

const commitMessage = messages[0].replaceAll('%s', version);
const tag = `theme-v${version}`;

execute('git', ['add', '.']);
execute('git', ['commit', '-m', commitMessage]);
execute('git', ['tag', tag]);
execute('git', ['push', '--atomic', 'origin', 'HEAD', `refs/tags/${tag}`]);
