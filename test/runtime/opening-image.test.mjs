import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const root = new URL('../../', import.meta.url);
const compile = async path => ts.transpileModule(await readFile(new URL(path, root), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const [loader, urls] = await Promise.all([
  compile('src/utils/openingImage.ts'), compile('src/utils/assetUrl.ts'),
]);
const moduleFrom = (source, context, require = () => { throw new Error('Unexpected import'); }) => {
  const module = { exports: {} };
  vm.runInContext('(function(require,module,exports){' + source + '\n})', context)(require, module, module.exports);
  return module.exports;
};
const prompt = JSON.parse(await readFile(new URL('public/projects/heart-sutra.json', root), 'utf8')).opening;
const png = await readFile(new URL('public' + prompt.asset.src, root));
const manifest = JSON.parse(await readFile(new URL('public' + prompt.manifest, root), 'utf8'));

function fixture(options = {}) {
  const revoked = [], requested = [], created = [];
  let releaseDecode;
  const decode = options.pending ? new Promise(resolve => { releaseDecode = resolve; }) : Promise.resolve();
  const context = vm.createContext({ crypto: webcrypto, Blob, Uint8Array, Array, Error,
    process: { env: { NEXT_PUBLIC_BASE_PATH: '/coscroll', NEXT_PUBLIC_ASSET_BASE: 'https://assets.aitoshuu.me/releases/test/' } },
    fetch: async (url, init) => {
      requested.push({ url, init });
      if (options.networkError) throw new TypeError('Offline');
      return { ok: !options.notFound, arrayBuffer: async () => {
        const bytes = options.bytes ?? png;
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      } };
    },
    URL: { createObjectURL: () => { created.push('blob:opening'); return 'blob:opening'; },
      revokeObjectURL: url => revoked.push(url) },
    Image: class {
      naturalWidth = options.wrongDimensions ? 1 : prompt.asset.width;
      naturalHeight = prompt.asset.height;
      async decode() { if (options.decodeError) throw new Error('Invalid PNG'); await decode; }
    },
  });
  const assetUrls = moduleFrom(urls, context);
  const { loadOpeningImage } = moduleFrom(loader, context, id => {
    assert.equal(id, './assetUrl'); return assetUrls;
  });
  return { load: signal => loadOpeningImage(prompt.asset, signal), requested, revoked, created,
    finishDecode: () => releaseDecode?.() };
}

test('the track preface PNG is frozen with its dimensions and Inko metadata', () => {
  assert.notEqual(prompt.text, '点击开始');
  assert.equal(prompt.attribution, 'AI生成 · Inko');
  assert.equal(JSON.stringify(manifest.opening.asset), JSON.stringify(prompt.asset));
  assert.equal(manifest.render.sceneText.replace(/\s/g, ''), prompt.text.replace(/\s/g, ''));
  assert.equal(manifest.render.glyphs.join('').replace(/\s/g, ''), prompt.text.replace(/\s/g, ''));
  assert.equal(png.byteLength, prompt.asset.bytes);
  assert.equal(createHash('sha256').update(png).digest('hex'), prompt.asset.sha256);
  assert.match(prompt.asset.src, new RegExp(prompt.asset.sha256.slice(0, 16)));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), prompt.asset.width);
  assert.equal(png.readUInt32BE(20), prompt.asset.height);
  assert.equal(png[25], 6, 'RGBA keeps the silk background visible');
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    chunks.push({ type: png.toString('ascii', offset + 4, offset + 8),
      data: png.subarray(offset + 8, offset + 8 + length).toString('utf8') });
    offset += length + 12;
  }
  assert.ok(chunks.some(chunk => chunk.type === 'iTXt' && chunk.data.startsWith('AIGC\0')));
  assert.ok(chunks.some(chunk => chunk.type === 'iTXt' && chunk.data.startsWith('XML:com.adobe.xmp\0')));
});

test('only a matching, decoded image is exposed using the release asset base', async () => {
  const f = fixture();
  assert.equal(await f.load(new AbortController().signal), 'blob:opening');
  assert.equal(f.requested[0].url, 'https://assets.aitoshuu.me/releases/test/' + prompt.asset.src.slice(1));
  assert.equal(f.requested[0].init.cache, 'force-cache');
  assert.deepEqual(f.revoked, []);
});

test('offline, missing, truncated and checksum-mismatched images leave the text fallback available', async () => {
  const corrupt = Buffer.from(png); corrupt[corrupt.length - 1] ^= 1;
  for (const options of [{ networkError: true }, { notFound: true }, { bytes: png.subarray(0, 20) }, { bytes: corrupt }]) {
    const f = fixture(options);
    await assert.rejects(f.load(new AbortController().signal));
    assert.deepEqual(f.created, []);
  }
});

test('decode and dimension failures release the object URL', async () => {
  for (const options of [{ decodeError: true }, { wrongDimensions: true }]) {
    const f = fixture(options);
    await assert.rejects(f.load(new AbortController().signal));
    assert.deepEqual(f.revoked, ['blob:opening']);
  }
});

test('a start or unmount while decoding cannot publish a stale image', async () => {
  const f = fixture({ pending: true }), controller = new AbortController();
  const loading = f.load(controller.signal);
  while (!f.created.length) await new Promise(resolve => setTimeout(resolve, 1));
  controller.abort(); f.finishDecode();
  await assert.rejects(loading, { name: 'AbortError' });
  assert.deepEqual(f.revoked, ['blob:opening']);
});
