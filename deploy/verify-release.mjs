#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { request as httpRequest } from 'node:http';
import { decodeDelivery, sameCachePolicy, sha, verifyPackage } from './release-lib.mjs';

const run = promisify(execFile);
async function request(url, extra = {}) {
  if (url.startsWith('http://127.0.0.1:')) {
    // fetch transparently decompresses. Use raw HTTP here to verify the stored
    // representation as well as its independently hashed decoded contents.
    return await new Promise((accept, reject) => {
      const request = httpRequest(url, {headers: extra, signal: AbortSignal.timeout(15000)}, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(response.headers)) {
            if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
          }
          accept({status: response.statusCode, headers, bytes: Buffer.concat(chunks)});
        });
      });
      request.on('error', reject); request.end();
    });
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
    const args = ['--silent', '--show-error', '--proto', '=https', '--connect-timeout', '10', '--max-time', '45',
      '--include', '--suppress-connect-headers'];
    for (const [name, value] of Object.entries(extra)) args.push('--header', `${name}: ${value}`);
    // Keep download bytes in memory so local disk pressure cannot truncate verification.
    const { stdout } = await run('curl', [...args, url], { encoding: 'buffer', timeout: 50000, maxBuffer: 128 * 1024 * 1024 });
    let offset = 0, block, status;
    do {
      const end = stdout.indexOf('\r\n\r\n', offset);
      if (end < 0) throw new Error('Missing HTTPS response headers');
      block = stdout.subarray(offset, end).toString('latin1');
      const match = /^HTTP\/\S+ (\d{3})\b/.exec(block);
      if (!match) throw new Error('Invalid HTTPS status line');
      status = Number(match[1]); offset = end + 4;
    } while (status >= 100 && status < 200);
    if ([429, 500, 502, 503, 504].includes(status) && attempt < 2) throw new Error(`Transient HTTPS status ${status}`);
    const headers = new Headers();
    for (const line of (block || '').split(/\r?\n/).slice(1)) {
      const colon = line.indexOf(':');
      if (colon > 0) headers.append(line.slice(0, colon), line.slice(colon + 1).trim());
    }
    return { status, headers, bytes: stdout.subarray(offset) };
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

try {
  if (!process.argv[2]) throw new Error('Usage: verify-release.mjs <package> [--local] [--cdn-only] [--origin https://tongye.me|https://aitoshuu.me]');
  const local = process.argv.includes('--local'), cdnOnly = process.argv.includes('--cdn-only');
  const root = resolve(process.argv[2]), manifest = await verifyPackage(root, { production: !local });
  if (local && manifest.deliveryProfile !== 'local') throw new Error('Local checks require a local-profile package');
  const originIndex = process.argv.indexOf('--origin');
  const origin = local ? 'http://127.0.0.1:4318' : originIndex < 0 ? 'https://aitoshuu.me' : process.argv[originIndex + 1];
  if (!local && !['https://aitoshuu.me', 'https://tongye.me'].includes(origin)) throw new Error('Origin is outside the approved CoScroll scope');
  let checked = 0, ranges = 0, encoded = 0;
  const entries = manifest.entries.filter(entry => !cdnOnly || entry.channel !== 'origin');
  // Four independent reads at a time; every file still receives all checks.
  for (let offset = 0; offset < entries.length; offset += 4) await Promise.all(entries.slice(offset, offset + 4).map(async entry => {
    const logical = entry.packagePath.slice((entry.channel === 'origin' ? 'web' : entry.channel).length + 1);
    const url = entry.channel === 'origin' ? `${origin}/coscroll/${logical}` :
      `${entry.channel === 'media' ? manifest.mediaBase : manifest.assetsBase}${logical}`;
    const response = await request(encodeURI(url), { Origin: origin, 'Accept-Encoding': entry.contentEncoding || 'identity' });
    if (response.status !== 200 || response.bytes.length !== entry.bytes || sha(response.bytes) !== entry.sha256) throw new Error(`HTTP/hash check failed: ${url} (${response.status})`);
    if (response.headers.get('content-encoding') !== (entry.contentEncoding || null)) throw new Error(`Content encoding mismatch: ${url}`);
    decodeDelivery(entry, response.bytes);
    if (entry.contentEncoding) encoded++;
    if (response.headers.get('content-type')?.split(';')[0] !== entry.mime.split(';')[0]) throw new Error(`MIME mismatch: ${url}`);
    if (!sameCachePolicy(response.headers.get('cache-control'), entry.cacheControl)) throw new Error(`Cache policy mismatch: ${url}`);
    if (entry.channel !== 'origin' && !['*', origin].includes(response.headers.get('access-control-allow-origin'))) throw new Error(`CORS failed: ${url}`);
    if (entry.channel === 'media') {
      const range = await request(encodeURI(url), { Origin: origin, Range: 'bytes=0-1023' });
      if (range.status !== 206 || range.headers.get('content-range') !== `bytes 0-1023/${entry.bytes}` ||
          response.headers.get('accept-ranges') !== 'bytes' || !range.bytes.equals(response.bytes.subarray(0, 1024))) throw new Error(`Audio Range check failed: ${url}`);
      ranges++;
    }
    checked++;
  }));
  if (!cdnOnly) {
    const canonical = await request(`${origin}/coscroll?probe=1`);
    if (canonical.status !== 308 || new URL(canonical.headers.get('location'), origin).pathname !== '/coscroll/' ||
        new URL(canonical.headers.get('location'), origin).search !== '?probe=1') throw new Error('Canonical redirect failed');
    const missing = await request(`${origin}/coscroll/_next/static/does-not-exist.js`);
    if (missing.status !== 404) throw new Error('Missing resource must return 404');
    if (!local) for (const path of ['/', '/lubirth/']) {
      const neighbor = await request(`${origin}${path}`);
      const accessible = neighbor.status === 200 || (neighbor.status >= 300 && neighbor.status < 400 && neighbor.headers.get('location'));
      if (!accessible || neighbor.bytes.includes(Buffer.from(manifest.releaseId))) throw new Error(`Existing site regression: ${path}`);
    }
  }
  console.log(JSON.stringify({ releaseId: manifest.releaseId, mode: local ? 'local' : 'public', origin, cdnOnly,
    checked, encoded, audioRanges: ranges, hashes: 'passed', decodedHashes: 'passed', mime: 'passed', cache: 'passed', cors: 'passed' }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
