#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const templateRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function stageThemePackage(destination) {
  const output = path.resolve(destination);
  try {
    if ((await readdir(output)).length !== 0) throw new Error('Theme package destination must be empty');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(output, { recursive: true });
  }
  const manifestSource = path.join(templateRoot, '.gala', 'managed-files.json');
  const manifest = JSON.parse(await readFile(manifestSource, 'utf8'));
  const artifactManifest = structuredClone(manifest);
  artifactManifest.artifactSources = { '.gitignore': '.gala/artifact-files/gitignore' };
  const identity = manifest.themePackage;
  if (identity?.name !== '@rathnasgala/theme' || typeof identity.version !== 'string') {
    throw new Error('Managed manifest has no publishable theme identity');
  }
  for (const [relative, expected] of Object.entries(manifest.files)) {
    const source = path.resolve(templateRoot, relative);
    const relation = path.relative(templateRoot, source);
    if (relation.startsWith('..') || path.isAbsolute(relation)) throw new Error(`Managed path escapes template: ${relative}`);
    const metadata = await lstat(source);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Managed source must be a regular file: ${relative}`);
    const bytes = await readFile(source);
    if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Managed source hash mismatch: ${relative}`);
    const artifactRelative = artifactManifest.artifactSources[relative] ?? relative;
    const target = path.join(output, 'payload', ...artifactRelative.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  await mkdir(path.join(output, 'payload', '.gala'), { recursive: true });
  await writeFile(
    path.join(output, 'payload', '.gala', 'managed-files.json'),
    `${JSON.stringify(artifactManifest, null, 2)}\n`
  );
  await writeFile(path.join(output, 'package.json'), `${JSON.stringify({
    name: identity.name,
    version: identity.version,
    description: 'Managed Gala static-site theme payload',
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'git+https://github.com/rathnasgala/site-template.git'
    },
    files: ['payload'],
    publishConfig: { access: 'public', provenance: true },
    engines: { node: '>=20' }
  }, null, 2)}\n`);
  return { output, name: identity.name, version: identity.version, fileCount: Object.keys(manifest.files).length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const destination = process.argv[2];
  if (!destination) throw new Error('usage: stage-theme-package.js <empty-destination>');
  const staged = await stageThemePackage(destination);
  process.stdout.write(`${staged.name}@${staged.version} (${staged.fileCount} managed files)\n`);
}
