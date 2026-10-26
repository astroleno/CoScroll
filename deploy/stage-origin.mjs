#!/usr/bin/env node
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { BASE_PATH, LEGACY_BASE_PATH, sha, verifyPackage } from './release-lib.mjs';

function canonicalLocations(basePath) {
  return [
    `location = ${basePath} { return 308 ${basePath}/$is_args$args; }`,
    `location = ${basePath}/release-health.json { alias /www/wwwroot/coscroll-current/release-health.json; set $fv_cache_control "no-store"; }`,
    `location ^~ ${basePath}/ { alias /www/wwwroot/coscroll-current/; index index.html; try_files $uri $uri/ =404; set $fv_cache_control "no-cache"; }`,
  ];
}

export function nginxLocations(basePath = BASE_PATH) {
  if (![BASE_PATH, LEGACY_BASE_PATH].includes(basePath)) throw new Error('Unknown CoScroll base path');
  const aliasPath = basePath === BASE_PATH ? LEGACY_BASE_PATH : BASE_PATH;
  return [
    ...canonicalLocations(basePath),
    `location = ${aliasPath} { return 308 ${basePath}/$is_args$args; }`,
    // Capture the original URI so encoded subpaths and query strings survive unchanged.
    `location ^~ ${aliasPath}/ { if ($request_uri ~ "^${aliasPath}(/.*)$") { return 308 ${basePath}$1; } return 404; }`,
  ];
}

export function draftNginxConfig(before, basePath = BASE_PATH) {
  const anchor = '    location = /lubirth {';
  if (!before.includes('add_header Cache-Control $fv_cache_control always;') ||
      !before.includes('root /www/wwwroot/aitoshuu.me-current;') || before.split(anchor).length !== 2) {
    throw new Error('The Nginx baseline differs from the existing shared-site layout');
  }
  const block = lines => lines.map(line => `    ${line}\n`).join('');
  const replacement = block(nginxLocations(basePath));
  const existing = before.match(/^\s*location\b[^\n]*\/coscroll\b/gim) || [];
  if (!existing.length) return { after: before.replace(anchor, replacement + '\n' + anchor),
    change: 'Add canonical CoScroll routes and a case alias before LuBirth; inherit all existing security headers.' };
  const known = [canonicalLocations(LEGACY_BASE_PATH), nginxLocations(BASE_PATH), nginxLocations(LEGACY_BASE_PATH)];
  for (const lines of known) {
    const previous = block(lines);
    if (existing.length === lines.length && before.split(previous).length === 2) {
      return { after: before.replace(previous, replacement),
        change: 'Replace the recognized CoScroll routing block with canonical routes and a case alias; preserve the rest of the vhost.' };
    }
  }
  throw new Error('CoScroll routing differs from a known block; inspect its configuration before editing');
}

async function main() {
  if (!process.argv[2]) throw new Error('Usage: stage-origin.mjs <cdn-package> [--nginx-baseline <file> --output <new-draft>]');
  const root = resolve(process.argv[2]);
  const manifest = await verifyPackage(root, { production: true });
  const options = {};
  for (let i = 3; i < process.argv.length; i += 2) {
    if (!['--nginx-baseline', '--output'].includes(process.argv[i]) || !process.argv[i + 1]) throw new Error('Invalid staging-plan arguments');
    options[process.argv[i].slice(2)] = resolve(process.argv[i + 1]);
  }
  if (Boolean(options.output) !== Boolean(options['nginx-baseline'])) throw new Error('Baseline and draft output must be supplied together');
  let configPlan;
  if (options.output) {
    const before = await readFile(options['nginx-baseline'], 'utf8');
    const { after, change } = draftNginxConfig(before, manifest.basePath);
    await writeFile(options.output, after, { flag: 'wx', mode: 0o600 });
    configPlan = { baseline: options['nginx-baseline'], baselineSha256: sha(before),
      proposedConfig: options.output, proposedSha256: sha(after), change };
  }
  console.log(JSON.stringify({ mode: 'offline-plan', releaseId: manifest.releaseId,
    artifactClosureSha256: manifest.artifactClosureSha256,
    source: `${root}/web`, destination: `/www/wwwroot/coscroll-releases/${manifest.releaseId}/web`,
    currentLink: '/www/wwwroot/coscroll-current',
    nginxConfig: '/www/server/panel/vhost/nginx/html_aitoshuu.me.conf',
    originFiles: manifest.entries.filter(entry => entry.channel === 'origin'),
    basePath: manifest.basePath, nginxLocations: nginxLocations(manifest.basePath), configPlan,
    activation: 'Review the current vhost diff and rollback anchor, stage and hash-check origin files, pass nginx -t, then atomically select this CoScroll release.',
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
