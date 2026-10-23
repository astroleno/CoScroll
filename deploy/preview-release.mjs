#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { verifyPackage } from './release-lib.mjs';

const root = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Usage: preview-release.mjs <local-package>');
const manifest = await verifyPackage(root);
if (manifest.deliveryProfile !== 'local') throw new Error('Only local-profile packages may use loopback preview');
const servers = [];
for (const [channel, port] of [['origin', 4318], ['assets', 4319], ['media', 4320]]) {
  const routes = new Map();
  for (const entry of manifest.entries.filter(item => item.channel === channel)) {
    const logical = entry.packagePath.slice((channel === 'origin' ? 'web' : channel).length + 1);
    const path = channel === 'origin' ? `/coscroll/${logical}` : `/${entry.objectKey}`;
    routes.set(path, entry);
    if (channel === 'origin' && path.endsWith('/index.html')) routes.set(path.slice(0, -10), entry);
  }
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://127.0.0.1:${port}`);
      if (channel === 'origin' && url.pathname === '/coscroll') {
        response.writeHead(308, { Location: `/coscroll/${url.search}` }); response.end(); return;
      }
      const entry = routes.get(decodeURIComponent(url.pathname));
      const headers = { 'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Encoding, Content-Range, Accept-Ranges, ETag',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Headers': 'Range',
        'X-Content-Type-Options': 'nosniff' };
      if (request.method === 'OPTIONS') { response.writeHead(204, headers); response.end(); return; }
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
      if (!entry) { response.writeHead(404, { ...headers, 'Content-Type': 'text/plain' }); response.end('Not found'); return; }
      const bytes = await readFile(join(root, entry.packagePath));
      Object.assign(headers, { 'Content-Type': entry.mime, 'Cache-Control': entry.cacheControl,
        'Accept-Ranges': 'bytes', ETag: `"${entry.sha256}"` });
      if (entry.contentEncoding) headers['Content-Encoding'] = entry.contentEncoding;
      let body = bytes, status = 200;
      if (request.headers.range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range);
        const start = match ? Number(match[1]) : -1;
        const end = match?.[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
        if (start < 0 || start >= bytes.length || start > end) {
          response.writeHead(416, { ...headers, 'Content-Range': `bytes */${bytes.length}` }); response.end(); return;
        }
        status = 206; body = bytes.subarray(start, end + 1);
        headers['Content-Range'] = `bytes ${start}-${end}/${bytes.length}`;
      }
      headers['Content-Length'] = String(body.length);
      response.writeHead(status, headers); response.end(request.method === 'HEAD' ? undefined : body);
    } catch { response.writeHead(500); response.end('Preview request failed'); }
  });
  server.on('error', error => { console.error(error.message); servers.forEach(item => item.close()); process.exitCode = 1; });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', accept); });
  servers.push(server);
}
console.log(JSON.stringify({ url: 'http://127.0.0.1:4318/coscroll/', releaseId: manifest.releaseId,
  channels: ['http://127.0.0.1:4319', 'http://127.0.0.1:4320'], mode: 'loopback-only' }));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => servers.forEach(server => server.close()));
