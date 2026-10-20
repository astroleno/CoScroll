import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { BASE_PATH, CACHE, MIME, bases, closureHash, sameCachePolicy, sha, validateManifest, verifyPackage } from '../../deploy/release-lib.mjs';

test('CDN cache directives may reorder while stale, private or incomplete policies fail', () => {
  assert.ok(sameCachePolicy('public, immutable, max-age=31536000', CACHE));
  assert.ok(sameCachePolicy(' PUBLIC, max-age=31536000, immutable ', CACHE));
  for (const invalid of [null, '', 'public, max-age=31536000', 'private, immutable, max-age=31536000',
    'public, immutable, max-age=300', CACHE + ', no-store']) {
    assert.equal(sameCachePolicy(invalid, CACHE), false);
  }
  assert.equal(sameCachePolicy('no-cache', 'no-store'), false);
});

const source = await readFile(new URL('../../src/utils/assetUrl.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function resolver(env = {}) {
  const exports = {};
  vm.runInNewContext(compiled, { exports, process: { env } });
  return exports;
}

test('release builds export static files; ordinary build/start retains Next server support', () => {
  const check = "import config from './next.config.mjs'; console.log(config.output || 'server');";
  const output = releaseId => execFileSync(process.execPath, ['--input-type=module', '-e', check], {
    cwd: new URL('../../', import.meta.url), encoding: 'utf8',
    env: { ...process.env, COSCROLL_RELEASE_ID: releaseId, NEXT_PUBLIC_BASE_PATH: '' },
  }).trim();
  assert.equal(output(''), 'server');
  assert.equal(output('coscroll-aaaaaaaaaaaaaaaa'), 'export');
});

test('logical resources work at the root and under a subdirectory', () => {
  assert.equal(resolver().assetUrl('/models/空.obj'), '/models/空.obj');
  const { assetUrl, mediaUrl } = resolver({ NEXT_PUBLIC_BASE_PATH: '/coscroll' });
  assert.equal(assetUrl('/fonts/心经.ttf'), '/coscroll/fonts/心经.ttf');
  assert.equal(assetUrl('/coscroll/fonts/心经.ttf'), '/coscroll/fonts/心经.ttf');
  assert.equal(mediaUrl('./audio/心经.mp3'), '/coscroll/audio/心经.mp3');
});

test('CDN channels keep configured resources in their own immutable release', () => {
  const { assetUrl, mediaUrl } = resolver({ NEXT_PUBLIC_BASE_PATH: '/coscroll',
    NEXT_PUBLIC_ASSET_BASE: 'https://assets.aitoshuu.me/releases/x/', NEXT_PUBLIC_MEDIA_BASE: 'https://media.aitoshuu.me/releases/x/' });
  assert.equal(assetUrl('/models/空.obj'), 'https://assets.aitoshuu.me/releases/x/models/空.obj');
  assert.equal(assetUrl('/audio/心经.mp3'), 'https://media.aitoshuu.me/releases/x/audio/心经.mp3');
  assert.equal(assetUrl('/coscroll/audio/心经.mp3'), 'https://media.aitoshuu.me/releases/x/audio/心经.mp3');
  const resolved = mediaUrl('/audio/心经.mp3');
  assert.equal(assetUrl(resolved), resolved);
  assert.equal(assetUrl('blob:local'), 'blob:local');
  assert.throws(() => assetUrl('/models/../private'), /inside the release/);
  assert.throws(() => assetUrl('/models/%2e%2e/private'), /inside the release/);
});

async function fixture(t, profile = 'cdn') {
  const root = await mkdtemp(join(tmpdir(), 'coscroll-release-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDigest = 'a'.repeat(64), releaseId = `coscroll-${sourceDigest.slice(0, 16)}`;
  const urls = bases(profile, releaseId), entries = [];
  for (const dir of ['web', 'assets', 'media', 'manifests']) await mkdir(join(root, dir));
  const files = [
    ['origin', 'index.html', `<meta name="coscroll-release-id" content="${releaseId}"><script src="${urls.assetsBase}_next/static/app.js"></script>`],
    ['origin', 'release-health.json', JSON.stringify({ site: 'CoScroll', releaseId, sourceDigest })],
    ['assets', '_next/static/app.js', 'console.log("CoScroll");'],
    ['media', 'audio/心经.mp3', 'fake-audio-bytes'],
  ];
  for (const [channel, name, text] of files) {
    const packagePath = `${channel === 'origin' ? 'web' : channel}/${name}`, bytes = Buffer.from(text);
    await mkdir(dirname(join(root, packagePath)), { recursive: true });
    await writeFile(join(root, packagePath), bytes);
    entries.push({ channel, packagePath, bytes: bytes.length, sha256: sha(bytes),
      mime: MIME[name.slice(name.lastIndexOf('.'))], cacheControl: channel === 'origin' ? (name === 'release-health.json' ? 'no-store' : 'no-cache') : CACHE,
      ...(channel === 'origin' ? {} : { objectKey: urls.objectPrefix + name }) });
  }
  const manifest = { schemaVersion: 1, site: 'CoScroll', sourceDigest, releaseId, deliveryProfile: profile,
    basePath: BASE_PATH, ...urls, entries, artifactClosureSha256: closureHash(entries) };
  await writeFile(join(root, 'manifests/release-manifest.json'), JSON.stringify(manifest));
  return { root, manifest };
}

test('complete packages pass, preview packages cannot be promoted', async t => {
  const { root } = await fixture(t);
  await verifyPackage(root, { production: true });
  const local = await fixture(t, 'local');
  await verifyPackage(local.root);
  await assert.rejects(verifyPackage(local.root, { production: true }), /identity or delivery profile/);
});

test('tampered files and unlisted source material block release', async t => {
  const { root } = await fixture(t);
  await writeFile(join(root, 'assets/_next/static/app.js'), 'altered');
  await assert.rejects(verifyPackage(root), /hash mismatch/);
  const other = await fixture(t);
  await writeFile(join(other.root, 'assets/private.map'), '{}');
  await assert.rejects(verifyPackage(other.root), /Unlisted delivery file/);
});

test('scope, cache, MIME, duplicates and encoded traversal are rejected', async t => {
  const { manifest } = await fixture(t);
  const attempts = [
    m => { m.assetsBase = 'https://example.com/'; },
    m => { m.entries[2].objectKey = 'releases/other/app.js'; },
    m => { m.entries[2].cacheControl = 'no-cache'; },
    m => { m.entries[2].mime = 'text/html'; },
    m => { m.entries.push(m.entries[2]); },
    m => { m.entries[2].packagePath = 'assets/%2e%2e/private'; },
    m => { m.entries[2].packagePath = 'assets/../private'; },
  ];
  for (const mutate of attempts) {
    const changed = structuredClone(manifest); mutate(changed);
    changed.artifactClosureSha256 = closureHash(changed.entries);
    assert.throws(() => validateManifest(changed));
  }
});

test('package symlinks cannot expose files outside the candidate', async t => {
  const { root } = await fixture(t);
  const path = join(root, 'assets/_next/static/app.js');
  await rm(path); await symlink('/etc/hosts', path);
  await assert.rejects(verifyPackage(root), /escaped its root/);
});
