import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import { execFileSync, spawn } from 'node:child_process';
import ts from 'typescript';
import { BASE_PATH, LEGACY_BASE_PATH, CACHE, MIME, bases, closureHash, decodeDelivery, encodeDelivery, sameCachePolicy, sha, validateManifest, verifyPackage } from '../../deploy/release-lib.mjs';
import { draftNginxConfig, nginxLocations } from '../../deploy/stage-origin.mjs';

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
  const check = "import config from './next.config.mjs'; console.log(JSON.stringify({output: config.output || 'server', basePath: config.basePath}));";
  const output = (releaseId, basePath = '') => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', check], {
    cwd: new URL('../../', import.meta.url), encoding: 'utf8',
    env: { ...process.env, COSCROLL_RELEASE_ID: releaseId, NEXT_PUBLIC_BASE_PATH: basePath }, stdio: 'pipe',
  }));
  assert.deepEqual(output(''), {output: 'server', basePath: ''});
  assert.deepEqual(output('coscroll-aaaaaaaaaaaaaaaa', '/CoScroll'), {output: 'export', basePath: '/CoScroll'});
  assert.deepEqual(output('', '/coscroll'), {output: 'server', basePath: '/coscroll'});
  for (const path of ['/CoScroll/', '/CoScroll/nested', '/..', '/%2f', '//CoScroll', '/CoScroll?x=1']) {
    assert.throws(() => output('', path), /single path segment/);
  }
});

test('logical resources work at the root and under a subdirectory', () => {
  assert.equal(resolver().assetUrl('/models/空.obj'), '/models/空.obj');
  for (const basePath of ['/CoScroll', '/coscroll']) {
    const { assetUrl, mediaUrl } = resolver({ NEXT_PUBLIC_BASE_PATH: basePath });
    assert.equal(assetUrl('/fonts/心经.ttf'), `${basePath}/fonts/心经.ttf`);
    for (const prefix of ['/CoScroll', '/coscroll']) {
      assert.equal(assetUrl(`${prefix}/fonts/心经.ttf`), `${basePath}/fonts/心经.ttf`);
      assert.equal(mediaUrl(`${prefix}/audio/心经.mp3`), `${basePath}/audio/心经.mp3`);
    }
    assert.equal(mediaUrl('./audio/心经.mp3'), `${basePath}/audio/心经.mp3`);
    assert.equal(assetUrl('/coscrolling/fonts/心经.ttf'), `${basePath}/coscrolling/fonts/心经.ttf`);
  }
});

test('CDN channels keep configured resources in their own immutable release', () => {
  const { assetUrl, mediaUrl } = resolver({ NEXT_PUBLIC_BASE_PATH: '/CoScroll',
    NEXT_PUBLIC_ASSET_BASE: 'https://assets.aitoshuu.me/releases/x/', NEXT_PUBLIC_MEDIA_BASE: 'https://media.aitoshuu.me/releases/x/' });
  assert.equal(assetUrl('/models/空.obj'), 'https://assets.aitoshuu.me/releases/x/models/空.obj');
  assert.equal(assetUrl('/audio/心经.mp3'), 'https://media.aitoshuu.me/releases/x/audio/心经.mp3');
  assert.equal(assetUrl('/coscroll/audio/心经.mp3'), 'https://media.aitoshuu.me/releases/x/audio/心经.mp3');
  assert.equal(assetUrl('/CoScroll/audio/心经.mp3'), 'https://media.aitoshuu.me/releases/x/audio/心经.mp3');
  const resolved = mediaUrl('/audio/心经.mp3');
  assert.equal(assetUrl(resolved), resolved);
  assert.equal(assetUrl('blob:local'), 'blob:local');
  assert.throws(() => assetUrl('/models/../private'), /inside the release/);
  assert.throws(() => assetUrl('/models/%2e%2e/private'), /inside the release/);
});

async function fixture(t, profile = 'cdn', basePath = BASE_PATH) {
  const root = await mkdtemp(join(tmpdir(), 'coscroll-release-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDigest = 'a'.repeat(64), releaseId = `coscroll-${sourceDigest.slice(0, 16)}`;
  const urls = bases(profile, releaseId), entries = [];
  for (const dir of ['web', 'assets', 'media', 'manifests']) await mkdir(join(root, dir));
  const files = [
    ['origin', 'index.html', `<meta name="coscroll-release-id" content="${releaseId}"><script src="${urls.assetsBase}_next/static/app.js"></script>`],
    ['origin', 'release-health.json', JSON.stringify({ site: 'CoScroll', releaseId, sourceDigest })],
    ['assets', '_next/static/app.js', 'console.log("CoScroll");'],
    ['media', 'audio/心经.mp3', 'fake-audio-bytes'.repeat(100)],
    ['origin', 'examples/空/index.html', '<title>Nested CoScroll route</title>'],
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
    basePath, ...urls, entries, artifactClosureSha256: closureHash(entries) };
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

test('new packages use CoScroll while historical lowercase manifests remain verifiable', async t => {
  assert.equal(BASE_PATH, '/CoScroll');
  const { root, manifest } = await fixture(t, 'cdn', '/coscroll');
  assert.equal((await verifyPackage(root, {production: true})).basePath, '/coscroll');
  for (const basePath of ['/COSCROLL', '/CoScroll/', '/other', '//CoScroll']) {
    assert.throws(() => validateManifest({...manifest, basePath}), /identity or delivery profile/);
  }
});

const nginxBaseline = `server {
    root /www/wwwroot/aitoshuu.me-current;
    add_header Cache-Control $fv_cache_control always;
    add_header X-Content-Type-Options nosniff always;
    location = /lubirth { return 308 /lubirth/; }
    location / { try_files $uri $uri/ =404; }
}
`;
const legacyNginxBlock = `    location = /coscroll { return 308 /coscroll/$is_args$args; }
    location = /coscroll/release-health.json { alias /www/wwwroot/coscroll-current/release-health.json; set $fv_cache_control "no-store"; }
    location ^~ /coscroll/ { alias /www/wwwroot/coscroll-current/; index index.html; try_files $uri $uri/ =404; set $fv_cache_control "no-cache"; }
`;

test('Nginx drafts add or migrate only recognized CoScroll routes and retain shared-site configuration', () => {
  const {after} = draftNginxConfig(nginxBaseline);
  assert.equal(after.replace(nginxLocations().map(line => `    ${line}\n`).join('') + '\n', ''), nginxBaseline);
  assert.ok(after.includes('location = /CoScroll { return 308 /CoScroll/$is_args$args; }'));
  assert.ok(after.includes('location = /coscroll { return 308 /CoScroll/$is_args$args; }'));
  assert.ok(after.includes('if ($request_uri ~ "^/coscroll(/.*)$") { return 308 /CoScroll$1; }'));
  assert.equal(draftNginxConfig(after).after, after, 'repeating the draft introduces no duplicates');
  const existing = nginxBaseline.replace('    location = /lubirth {', legacyNginxBlock + '\n    location = /lubirth {');
  assert.equal(draftNginxConfig(existing).after, after, 'historical routes are replaced, not shadowed');
  const rollback = draftNginxConfig(after, LEGACY_BASE_PATH).after;
  assert.ok(rollback.includes('location = /CoScroll { return 308 /coscroll/$is_args$args; }'));
  assert.equal(draftNginxConfig(rollback).after, after, 'legacy package routing can migrate back');
  for (const unknown of [
    existing.replace('index index.html;', 'index custom.html;'),
    existing.replace('    location / {', '    location = /CoScroll/private { return 403; }\n    location / {'),
    existing.replace('add_header Cache-Control $fv_cache_control always;', ''),
    nginxBaseline.replace('    location / {', '    location = /CoScroll { return 302 /other; }\n    location / {'),
  ]) assert.throws(() => draftNginxConfig(unknown), /baseline differs|routing differs/);
});

test('staging writes a separate draft, leaves the baseline intact and refuses to overwrite output', async t => {
  const {root} = await fixture(t);
  const baseline = join(root, 'baseline.conf'), output = join(root, 'proposed.conf');
  await writeFile(baseline, nginxBaseline);
  const args = ['deploy/stage-origin.mjs', root, '--nginx-baseline', baseline, '--output', output];
  const plan = JSON.parse(execFileSync(process.execPath, args, {cwd: new URL('../../', import.meta.url), encoding: 'utf8', stdio: 'pipe'}));
  assert.equal(plan.mode, 'offline-plan');
  assert.equal(plan.basePath, '/CoScroll');
  assert.equal(await readFile(baseline, 'utf8'), nginxBaseline);
  assert.equal(sha(await readFile(output)), plan.configPlan.proposedSha256);
  assert.throws(() => execFileSync(process.execPath, args, {cwd: new URL('../../', import.meta.url), stdio: 'pipe'}), /EEXIST/);
});

async function startPreview(t, root) {
  const child = spawn(process.execPath, ['deploy/preview-release.mjs', root], {
    cwd: new URL('../../', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'],
  });
  let finished = false, stderr = '';
  const closed = new Promise(resolve => child.once('close', () => { finished = true; resolve(); }));
  const stop = async () => { if (!finished) { child.kill('SIGTERM'); await closed; } };
  t.after(stop);
  child.stderr.on('data', bytes => { stderr += bytes; });
  const ready = await new Promise((resolve, reject) => {
    let stdout = '';
    const timeout = setTimeout(() => reject(new Error('Preview did not become ready')), 15000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('close', code => { clearTimeout(timeout); reject(new Error(`Preview exited ${code}: ${stderr}`)); });
    child.stdout.on('data', bytes => {
      stdout += bytes;
      if (stdout.includes('\n')) {
        clearTimeout(timeout);
        try { resolve(JSON.parse(stdout.split('\n')[0])); } catch (error) { reject(error); }
      }
    });
  });
  return {ready, stop};
}

test('real preview HTTP accepts both casings, retains encoded subpaths and queries, and passes the release verifier', {timeout: 60000}, async t => {
  for (const basePath of ['/CoScroll', '/coscroll']) {
    const {root, manifest} = await fixture(t, 'local', basePath);
    const {ready, stop} = await startPreview(t, root);
    try {
      assert.equal(ready.url, `http://127.0.0.1:4318${basePath}/`);
      const alias = basePath === '/CoScroll' ? '/coscroll' : '/CoScroll';
      const query = '?project=lotus-sutra-zanshi&note=%E5%A6%99%20%E6%B3%95&repeat=1&repeat=2';
      for (const [path, target] of [
        [basePath, `${basePath}/`], [alias, `${basePath}/`], [`${alias}/`, `${basePath}/`],
        [`${alias}/release-health.json`, `${basePath}/release-health.json`],
        [`${alias}/examples/%E7%A9%BA/`, `${basePath}/examples/%E7%A9%BA/`],
        [`${alias}/_next/static/does-not-exist.js`, `${basePath}/_next/static/does-not-exist.js`],
      ]) {
        const response = await fetch(`http://127.0.0.1:4318${path}${query}`, {redirect: 'manual'});
        assert.equal(response.status, 308, path);
        assert.equal(response.headers.get('location'), target + query, path);
        await response.arrayBuffer();
      }
      const home = await fetch(`${ready.url}${query}`);
      assert.equal(home.status, 200);
      assert.equal(sha(Buffer.from(await home.arrayBuffer())), manifest.entries[0].sha256);
      const nested = await fetch(`http://127.0.0.1:4318${alias}/examples/%E7%A9%BA/${query}`);
      assert.equal(nested.status, 200);
      assert.match(await nested.text(), /Nested CoScroll route/);
      for (const path of [`${alias}/_next/static/does-not-exist.js`, '/coscrolling/', '/COSCROLL/']) {
        const missing = await fetch(`http://127.0.0.1:4318${path}`);
        assert.equal(missing.status, 404, path);
        await missing.arrayBuffer();
      }
      const report = JSON.parse(execFileSync(process.execPath, ['deploy/verify-release.mjs', root, '--local'], {
        cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 30000, stdio: 'pipe',
      }));
      assert.equal(report.basePath, basePath);
      assert.equal(report.checked, manifest.entries.length);
      assert.equal(report.audioRanges, 1);
      assert.equal(report.redirects, basePath === '/CoScroll' ? 5 : 1);
    } finally { await stop(); }
  }
});

test('dedicated opening images and manifests are release assets; source packages and arbitrary opening files are excluded', async t => {
  const {manifest} = await fixture(t);
  for (const [path, accepted] of [
    ['opening/heart-sutra/preface.0123456789abcdef.png', true],
    ['opening/heart-sutra/manifest.0123456789abcdef.json', true],
    ['opening/heart-sutra/source.png', false], ['opening/heart-sutra/scene.zip', false],
    ['opening/shared.js', false], ['opening/heart-sutra/preface.png', false],
  ]) {
    const next = structuredClone(manifest), bytes = Buffer.from('fixture');
    next.entries.push({channel: 'assets', packagePath: `assets/${path}`, bytes: bytes.length, sha256: sha(bytes),
      mime: MIME[path.slice(path.lastIndexOf('.'))], cacheControl: CACHE, objectKey: manifest.objectPrefix + path});
    next.artifactClosureSha256 = closureHash(next.entries);
    if (accepted) assert.equal(validateManifest(next), next);
    else assert.throws(() => validateManifest(next));
  }
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

test('gzip delivery preserves content bits and keeps audio, fonts and images unencoded', () => {
  const original = Buffer.from('const scripture = "妙法莲华经";\n'.repeat(1000));
  for (const name of ['_next/static/app.js', 'models/prepared/妙.json', 'models/prepared/妙.bin', 'lyrics/妙.lrc', 'models/妙.obj', 'textures/sky.hdr']) {
    const {bytes, metadata} = encodeDelivery('assets', name, original);
    assert.equal(metadata.contentEncoding, 'gzip');
    assert.ok(bytes.length < original.length * .9);
    assert.deepEqual(decodeDelivery({...metadata, packagePath: name}, bytes), original);
    assert.deepEqual(encodeDelivery('assets', name, original).bytes, bytes, 'deterministic stored representation');
    assert.throws(() => decodeDelivery({...metadata, decodedSha256: '0'.repeat(64)}, bytes), /Decoded content hash/);
    assert.throws(() => decodeDelivery({...metadata, decodedBytes: original.length - 1}, bytes));
  }
  for (const [channel, name] of [['media', 'audio/经.mp3'], ['origin', 'index.html'],
    ['assets', 'fonts/full.woff2'], ['assets', 'images/a.jpg'], ['assets', 'textures/normal.png']]) {
    const delivered = encodeDelivery(channel, name, original);
    assert.equal(delivered.bytes, original);
    assert.deepEqual(delivered.metadata, {});
  }
});

test('gzip package verification checks both stored and decoded hashes; old packages remain valid', async t => {
  const {root, manifest} = await fixture(t);
  const entry = manifest.entries.find(e => e.channel === 'assets');
  const original = Buffer.from('console.log("心经 妙法莲华经");\n'.repeat(1000));
  const {bytes, metadata} = encodeDelivery('assets', entry.packagePath, original);
  Object.assign(entry, metadata, {bytes: bytes.length, sha256: sha(bytes)});
  await writeFile(join(root, entry.packagePath), bytes);
  const save = async () => {
    manifest.artifactClosureSha256 = closureHash(manifest.entries);
    await writeFile(join(root, 'manifests/release-manifest.json'), JSON.stringify(manifest));
  };
  await save(); await verifyPackage(root, {production: true});
  entry.decodedSha256 = '0'.repeat(64);
  await save(); await assert.rejects(verifyPackage(root), /Decoded content hash/);
  entry.decodedSha256 = metadata.decodedSha256;
  for (const mutate of [e => {e.contentEncoding = 'br';}, e => {e.decodedBytes = e.bytes;},
    e => {delete e.contentEncoding;}, e => {e.channel = 'media'; e.packagePath = 'media/audio/经.mp3';}]) {
    const changed = structuredClone(manifest); mutate(changed.entries.find(e => e.channel === 'assets'));
    changed.artifactClosureSha256 = closureHash(changed.entries);
    assert.throws(() => validateManifest(changed));
  }
});

test('COS immutable-object matching requires the stored content encoding as well as hash and length', () => {
  const script = `import importlib.util, json
s=importlib.util.spec_from_file_location('upload','deploy/upload-cos-release.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
e={'bytes':17,'mime':'text/javascript; charset=utf-8','cacheControl':m.CACHE,'sha256':'a'*64,'contentEncoding':'gzip'}
h={'Content-Length':'17','Content-Type':e['mime'],'Cache-Control':m.CACHE,'x-cos-meta-sha256':e['sha256'],'x-cos-meta-release-id':'rid','Content-Encoding':'gzip'}
assert m.matches(e,h,'rid')
assert not m.matches(e,{k:v for k,v in h.items() if k!='Content-Encoding'},'rid')
assert not m.matches(e,{**h,'Content-Encoding':'br'},'rid')
assert not m.matches({k:v for k,v in e.items() if k!='contentEncoding'},h,'rid')
print('passed')`;
  assert.equal(execFileSync('python3', ['-B', '-c', script], {cwd: new URL('../../', import.meta.url), encoding: 'utf8'}).trim(), 'passed');
});
