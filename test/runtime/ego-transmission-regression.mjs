import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import ts from 'typescript';
import {performanceInstrumentation} from './ego-performance.mjs';
import {rendererProbeScript} from './ego-renderer.mjs';
import {installRegionRegression, compareRegionModel, disposeRegionRegression} from './transmission-region-browser.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** Uses an existing managed Ego page; all probes are test-only and reload with it. */
export async function runTransmissionRegression(page, {url, limit} = {}) {
  const registry = JSON.parse(await readFile(resolve(root, 'src/components/jade/prepared-models.json'), 'utf8'));
  const compile = async name => ts.transpileModule(await readFile(resolve(root, name), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
  }).outputText;
  const [decoder, bounds, binary] = await Promise.all([
    compile('src/components/jade/preparedModelGeometry.ts'),
    compile('src/rendering/transmissionUpdateRegion.ts'),
    compile('src/components/jade/preparedModelDelivery.ts'),
  ]);
  await page.cdp('Page.addScriptToEvaluateOnNewDocument', {source: performanceInstrumentation() + ';\n' + rendererProbeScript()});
  await page.cdp('Emulation.setFocusEmulationEnabled', {enabled: true});
  const models = limit ? registry.models.slice(0, limit) : registry.models;
  const results = [];
  for (const layout of [{name: 'mobile', width: 390, height: 844, dpr: 3, mobile: true},
    {name: 'desktop', width: 1440, height: 900, dpr: 1, mobile: false}]) {
    await page.cdp('Emulation.setDeviceMetricsOverride', {width: layout.width, height: layout.height,
      deviceScaleFactor: layout.dpr, mobile: layout.mobile});
    await page.cdp('Emulation.setTouchEmulationEnabled', {enabled: layout.mobile});
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});
    await page.waitForSelector('[data-coscroll-intro]', {state: 'visible', timeout: 90000});
    await page.click('[data-coscroll-intro]', {label: 'enter scripture reading'});
    await page.waitForFunction(() => window.__coscrollPerf?.milestones.sceneReadyMs &&
      document.querySelector('audio')?.readyState >= 3 && !document.querySelector('audio').paused,
    undefined, {timeout: 90000});
    await page.click('button[aria-label="Pause"]', {label: 'pause for pixel comparison'});
    await page.waitForFunction(() => document.querySelector('audio').paused, undefined, {timeout: 10000});
    const environment = await installRegionRegression(page, decoder, bounds, binary);
    const comparisons = [];
    try {
      for (const [index, entry] of models.entries()) {
        // This entry targets a local build with assets below its application base path.
        const asset = new URL(url); asset.search = asset.hash = '';
        if (!asset.pathname.endsWith('/')) asset.pathname += '/';
        const modelUrl = new URL(entry.preparedPath.replace(/^\//, ''), asset).href;
        comparisons.push(await compareRegionModel(page, {...entry, url: modelUrl,
          generation: entry.generation ?? registry.generation}));
        if (index === 0 || (index + 1) % 10 === 0 || index === models.length - 1) {
          console.log(JSON.stringify({layout: layout.name, checked: index + 1, models: models.length}));
        }
      }
    } finally {await disposeRegionRegression(page);}
    const errors = await page.evaluate(() => window.__coscrollPerf.errors);
    if (errors.length) throw Error('Page runtime errors: ' + JSON.stringify(errors));
    results.push({layout, environment, comparisons, errors});
  }
  return {passed: true, url, models: models.length, fullRegistry: models.length === registry.models.length,
    frames: results.reduce((sum, layout) => sum + layout.comparisons.reduce((n, r) => n + r.frames.length, 0), 0), results};
}

async function main() {
  const {values} = parseArgs({options: {url: {type: 'string'}, output: {type: 'string'},
    space: {type: 'string'}, limit: {type: 'string'}, help: {type: 'boolean'}}});
  if (values.help || !values.url) {
    console.log('npm run test:visual -- --url http://127.0.0.1:3248/ [--output /absolute/result.json] [--space existing-id] [--limit smoke-model-count]');
    if (!values.help) process.exitCode = 1;
    return;
  }
  const url = new URL(values.url).href;
  for (const key of ['space', 'limit']) {
    if (values[key] !== undefined && (!/^\d+$/.test(values[key]) || Number(values[key]) < 1)) throw Error('Invalid --' + key);
  }
  const options = {url, limit: values.limit ? Number(values.limit) : undefined};
  const script = `
const {runTransmissionRegression} = await import(${JSON.stringify(pathToFileURL(fileURLToPath(import.meta.url)).href)});
const task = await taskSpace(${values.space ? Number(values.space) : JSON.stringify('CoScroll transmission ' + new Date().toISOString())});
console.log(JSON.stringify({spaceId: task.spaceId}));
const result = await runTransmissionRegression(task.page('p1'), ${JSON.stringify(options)});
${values.output ? `await (await import('node:fs/promises')).writeFile(${JSON.stringify(resolve(values.output))}, JSON.stringify(result, null, 2) + '\\n');` : ''}
console.log(JSON.stringify({passed: result.passed, models: result.models, frames: result.frames, fullRegistry: result.fullRegistry}));
${values.space ? '' : 'await task.finish({keep: []});'}
`;
  const code = await new Promise((resolve, reject) => {
    const child = spawn('ego-browser', ['nodejs'], {stdio: ['pipe', 'inherit', 'inherit']});
    child.on('error', reject); child.on('exit', code => resolve(code ?? 1)); child.stdin.end(script);
  });
  process.exitCode = code;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
