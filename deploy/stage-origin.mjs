#!/usr/bin/env node
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { sha, verifyPackage } from './release-lib.mjs';

try {
  if (!process.argv[2]) throw new Error('Usage: stage-origin.mjs <cdn-package> [--nginx-baseline <file> --output <new-draft>]');
  const root = resolve(process.argv[2]);
  const manifest = await verifyPackage(root, { production: true });
  const nginxLocations = [
    'location = /coscroll { return 308 /coscroll/$is_args$args; }',
    'location = /coscroll/release-health.json { alias /www/wwwroot/coscroll-current/release-health.json; set $fv_cache_control "no-store"; }',
    'location ^~ /coscroll/ { alias /www/wwwroot/coscroll-current/; index index.html; try_files $uri $uri/ =404; set $fv_cache_control "no-cache"; }',
  ];
  const options = {};
  for (let i = 3; i < process.argv.length; i += 2) {
    if (!['--nginx-baseline', '--output'].includes(process.argv[i]) || !process.argv[i + 1]) throw new Error('Invalid staging-plan arguments');
    options[process.argv[i].slice(2)] = resolve(process.argv[i + 1]);
  }
  if (Boolean(options.output) !== Boolean(options['nginx-baseline'])) throw new Error('Baseline and draft output must be supplied together');
  let configPlan;
  if (options.output) {
    const before = await readFile(options['nginx-baseline'], 'utf8');
    const anchor = '    location = /lubirth {';
    if (!before.includes('add_header Cache-Control $fv_cache_control always;') ||
        !before.includes('root /www/wwwroot/aitoshuu.me-current;') || before.split(anchor).length !== 2) {
      throw new Error('The Nginx baseline differs from the existing shared-site layout');
    }
    if (/location[^\n]*\/coscroll/.test(before)) throw new Error('CoScroll routing already exists; inspect its configuration before editing');
    const insert = nginxLocations.map(line => `    ${line}\n`).join('') + '\n';
    const after = before.replace(anchor, insert + anchor);
    await writeFile(options.output, after, { flag: 'wx', mode: 0o600 });
    configPlan = { baseline: options['nginx-baseline'], baselineSha256: sha(before),
      proposedConfig: options.output, proposedSha256: sha(after), change: 'Add three CoScroll locations before the existing LuBirth locations; inherit all existing security headers.' };
  }
  console.log(JSON.stringify({ mode: 'offline-plan', releaseId: manifest.releaseId,
    artifactClosureSha256: manifest.artifactClosureSha256,
    source: `${root}/web`, destination: `/www/wwwroot/coscroll-releases/${manifest.releaseId}/web`,
    currentLink: '/www/wwwroot/coscroll-current',
    nginxConfig: '/www/server/panel/vhost/nginx/html_aitoshuu.me.conf',
    originFiles: manifest.entries.filter(entry => entry.channel === 'origin'),
    nginxLocations, configPlan,
    activation: 'Review the current vhost diff and rollback anchor, stage and hash-check origin files, pass nginx -t, then atomically select this CoScroll release.',
  }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
