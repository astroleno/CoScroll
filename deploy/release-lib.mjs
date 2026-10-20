import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';

export const OBJECT_ROOT = 'releases/aitoshuu-me/';
export const CACHE = 'public, max-age=31536000, immutable';
export const BASE_PATH = '/coscroll';
export const MIME = {
  '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.lrc': 'text/plain; charset=utf-8',
  '.srt': 'text/plain; charset=utf-8', '.obj': 'text/plain; charset=utf-8',
  '.hdr': 'application/octet-stream', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
};
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function sameCachePolicy(actual, expected) {
  // CDN edges may reorder directives without changing the cache contract.
  const normalize = value => value.split(',').map(part => part.trim().toLowerCase()).sort().join(',');
  return typeof actual === 'string' && normalize(actual) === normalize(expected);
}
export const excluded = path => path.split('/').some(part =>
  part === '.DS_Store' || part === '.gitkeep' || part.startsWith('._') || /\.(?:backup|bak|map)$/.test(part));

export async function walk(directory) {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not release files: ${path}`);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unsupported release file: ${path}`);
  }
  return files;
}

export function relativePath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\') ||
      /%(?:2e|2f|5c)/i.test(path) || path.split('/').some(part => !part || part === '.' || part === '..') || excluded(path)) {
    throw new Error(`Unsafe release path: ${path}`);
  }
  return path;
}

export function bases(profile, releaseId) {
  if (!['cdn', 'local'].includes(profile)) throw new Error('Unknown delivery profile');
  const prefix = `${OBJECT_ROOT}${releaseId}/`;
  return { objectPrefix: prefix,
    assetsBase: `${profile === 'cdn' ? 'https://assets.aitoshuu.me' : 'http://127.0.0.1:4319'}/${prefix}`,
    mediaBase: `${profile === 'cdn' ? 'https://media.aitoshuu.me' : 'http://127.0.0.1:4320'}/${prefix}` };
}

export const closureHash = entries => sha(JSON.stringify([...entries].sort((a, b) => a.packagePath.localeCompare(b.packagePath))));

export function validateManifest(manifest, { production = false } = {}) {
  if (manifest.schemaVersion !== 1 || manifest.site !== 'CoScroll' ||
      !/^[0-9a-f]{64}$/.test(manifest.sourceDigest || '') ||
      manifest.releaseId !== `coscroll-${manifest.sourceDigest.slice(0, 16)}` ||
      manifest.basePath !== BASE_PATH || (production && manifest.deliveryProfile !== 'cdn')) {
    throw new Error('Invalid CoScroll release identity or delivery profile');
  }
  const expected = bases(manifest.deliveryProfile, manifest.releaseId);
  if (Object.entries(expected).some(([key, value]) => manifest[key] !== value)) throw new Error('CDN bases differ from the release scope');
  if (!Array.isArray(manifest.entries) || !manifest.entries.length) throw new Error('Release has no entries');
  const paths = new Set(), objects = new Set();
  for (const entry of manifest.entries) {
    relativePath(entry.packagePath);
    if (!['origin', 'assets', 'media'].includes(entry.channel)) throw new Error('Unknown release channel');
    const directory = entry.channel === 'origin' ? 'web' : entry.channel;
    if (!entry.packagePath.startsWith(`${directory}/`)) throw new Error('Package channel mismatch');
    const logical = entry.packagePath.slice(directory.length + 1);
    const extension = extname(logical).toLowerCase();
    if (entry.mime !== MIME[extension] || !entry.mime || !Number.isSafeInteger(entry.bytes) || entry.bytes <= 0 ||
        !/^[0-9a-f]{64}$/.test(entry.sha256 || '') || paths.has(entry.packagePath)) throw new Error('Invalid release metadata or duplicate path');
    paths.add(entry.packagePath);
    if (entry.channel === 'origin') {
      if ((!['.html', '.txt'].includes(extension) && logical !== 'release-health.json') || entry.objectKey ||
          entry.cacheControl !== (logical === 'release-health.json' ? 'no-store' : 'no-cache')) throw new Error('Invalid origin entry');
    } else {
      if (entry.cacheControl !== CACHE || entry.objectKey !== `${expected.objectPrefix}${logical}` || objects.has(entry.objectKey)) throw new Error('Object is outside the immutable release');
      if (entry.channel === 'media' ? (!logical.startsWith('audio/') || !['.mp3', '.wav', '.ogg', '.flac'].includes(extension)) :
          (!/^(?:_next\/static|fonts|models|textures|lyrics|projects|images)\//.test(logical) || extension === '.html')) throw new Error('Asset is in the wrong channel');
      objects.add(entry.objectKey);
    }
  }
  if (!paths.has('web/index.html') || !paths.has('web/release-health.json') || !objects.size ||
      manifest.artifactClosureSha256 !== closureHash(manifest.entries)) throw new Error('Release closure is incomplete');
  return manifest;
}

export async function checkedFile(root, path) {
  relativePath(path);
  const absolute = resolve(root, path);
  if (!(await realpath(absolute)).startsWith(`${await realpath(root)}${sep}`) || !(await lstat(absolute)).isFile()) throw new Error('Package file escaped its root');
  return absolute;
}

export async function verifyPackage(root, options) {
  root = resolve(root);
  const manifest = validateManifest(JSON.parse(await readFile(await checkedFile(root, 'manifests/release-manifest.json'), 'utf8')), options);
  const expected = new Set(manifest.entries.map(entry => entry.packagePath));
  for (const entry of manifest.entries) {
    const bytes = await readFile(await checkedFile(root, entry.packagePath));
    if (bytes.length !== entry.bytes || sha(bytes) !== entry.sha256) throw new Error(`Package hash mismatch: ${entry.packagePath}`);
  }
  for (const directory of ['web', 'assets', 'media']) {
    for (const file of await walk(join(root, directory))) {
      const path = relative(root, file).split(sep).join('/');
      if (!expected.has(path)) throw new Error(`Unlisted delivery file: ${path}`);
    }
  }
  const html = await readFile(join(root, 'web/index.html'), 'utf8');
  if (!html.includes(manifest.assetsBase) || !html.includes(manifest.releaseId)) throw new Error('HTML is not pinned to this release');
  const health = JSON.parse(await readFile(join(root, 'web/release-health.json'), 'utf8'));
  if (health.releaseId !== manifest.releaseId || health.sourceDigest !== manifest.sourceDigest) throw new Error('Release health identity mismatch');
  return manifest;
}
