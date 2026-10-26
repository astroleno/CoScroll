#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants } from 'node:fs';
import { BASE_PATH, CACHE, MIME, bases, closureHash, encodeDelivery, excluded, sha, verifyPackage, walk } from './release-lib.mjs';
import { checkPreparedModels } from './prepare-models.mjs';
import { checkTrackOpenings } from './prepare-track.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inputs = ['src', 'public', 'deploy', 'next.config.mjs', 'package.json', 'package-lock.json',
  'tsconfig.json', 'next-env.d.ts', 'tailwind.config.ts', 'postcss.config.js', '.eslintrc.json'];

async function sourceIdentity(profile) {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ node: process.version, next: JSON.parse(await readFile(join(root, 'node_modules/next/package.json'))).version, profile, basePath: BASE_PATH }));
  for (const input of inputs) {
    const paths = /\.[a-z]+$/.test(input) || input.startsWith('.') ? [join(root, input)] : await walk(join(root, input));
    for (const file of paths.sort()) {
      const path = relative(root, file).split(sep).join('/');
      if (excluded(path) || path.includes('__pycache__/')) continue;
      hash.update(path); hash.update('\0'); hash.update(await readFile(file)); hash.update('\0');
    }
  }
  return hash.digest('hex');
}

async function main() {
  const args = process.argv.slice(2), options = { profile: 'cdn' };
  for (let i = 0; i < args.length; i += 2) {
    if (!['--output', '--profile'].includes(args[i]) || !args[i + 1]) throw new Error('Usage: package-release.mjs --output <new-directory> [--profile cdn|local]');
    options[args[i].slice(2)] = args[i + 1];
  }
  if (!options.output) throw new Error('--output is required');
  const output = resolve(options.output);
  if (output === root || (output.startsWith(`${root}${sep}`) && !output.startsWith(`${root}/.cache/releases/`))) throw new Error('Output must be outside source inputs or inside .cache/releases');
  await checkTrackOpenings(root);
  await checkPreparedModels();
  const sourceDigest = await sourceIdentity(options.profile);
  const releaseId = `coscroll-${sourceDigest.slice(0, 16)}`;
  const urls = bases(options.profile, releaseId);
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output);
  await new Promise((accept, reject) => {
    const child = spawn('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', env: {
      ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_BASE_PATH: BASE_PATH,
      NEXT_PUBLIC_ASSET_BASE: urls.assetsBase, NEXT_PUBLIC_MEDIA_BASE: urls.mediaBase, COSCROLL_RELEASE_ID: releaseId,
    } });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? accept() : reject(new Error(`Production build failed (${code})`)));
  });
  if (await sourceIdentity(options.profile) !== sourceDigest) throw new Error('Source inputs changed while building; discard this candidate and rebuild');
  const exportRoot = join(root, 'out');
  const publicPaths = new Set((await walk(join(root, 'public'))).map(file => relative(join(root, 'public'), file).split(sep).join('/')));
  const entries = [];
  for (const directory of ['web', 'assets', 'media', 'manifests']) await mkdir(join(output, directory));
  for (const file of await walk(exportRoot)) {
    const path = relative(exportRoot, file).split(sep).join('/');
    if (excluded(path)) continue;
    let channel;
    if (publicPaths.has(path)) channel = path.startsWith('audio/') ? 'media' : 'assets';
    else if (path.startsWith('_next/static/')) channel = 'assets';
    else if (/\.(?:html|txt)$/.test(path)) channel = 'origin';
    else throw new Error(`Unexpected static export: ${path}`);
    const mime = MIME[extname(path).toLowerCase()];
    if (!mime) throw new Error(`Unsupported delivery MIME: ${path}`);
    const original = await readFile(file);
    if (!original.length) throw new Error(`Empty delivery file: ${path}`);
    const {bytes, metadata} = encodeDelivery(channel, path, original);
    const packagePath = `${channel === 'origin' ? 'web' : channel}/${path}`;
    await mkdir(dirname(join(output, packagePath)), { recursive: true });
    // CoW cloning preserves an independent immutable snapshot on APFS/Btrfs;
    // unsupported filesystems fall back to an ordinary copy.
    if (metadata.contentEncoding) await writeFile(join(output, packagePath), bytes);
    else await cp(file, join(output, packagePath), { mode: constants.COPYFILE_FICLONE });
    entries.push({ channel, packagePath, bytes: bytes.length, sha256: sha(bytes), mime,
      ...metadata,
      cacheControl: channel === 'origin' ? 'no-cache' : CACHE,
      ...(channel === 'origin' ? {} : { objectKey: `${urls.objectPrefix}${path}` }),
    });
  }
  const health = Buffer.from(`${JSON.stringify({ site: 'CoScroll', releaseId, sourceDigest })}\n`);
  await writeFile(join(output, 'web/release-health.json'), health);
  entries.push({ channel: 'origin', packagePath: 'web/release-health.json', bytes: health.length,
    sha256: sha(health), mime: MIME['.json'], cacheControl: 'no-store' });
  entries.sort((a, b) => a.packagePath.localeCompare(b.packagePath));
  const manifest = { schemaVersion: 1, site: 'CoScroll', releaseId, sourceDigest, basePath: BASE_PATH,
    deliveryProfile: options.profile, ...urls, entries, artifactClosureSha256: closureHash(entries) };
  await writeFile(join(output, 'manifests/release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await verifyPackage(output);
  console.log(JSON.stringify({ output, releaseId, deliveryProfile: options.profile,
    artifactClosureSha256: manifest.artifactClosureSha256, files: entries.length,
    cdnObjects: entries.filter(entry => entry.objectKey).length,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0) }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
