import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

export async function loadPreloaderModule(directory) {
  for (const name of ['assetUrl', 'ModelPreloader']) {
    const path = name === 'assetUrl' ? '../../src/utils/assetUrl.ts' : '../../src/components/jade/ModelPreloader.ts';
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,
      target:ts.ScriptTarget.ES2020}}).outputText
      .replaceAll("'@/utils/assetUrl'", "'./assetUrl.mjs'")
      .replaceAll("'./modelGeometry'", "'./modelGeometry.mjs'")
      .replaceAll("'./preparedModelGeometry'", "'./preparedModelGeometry.mjs'")
      .replaceAll("'./preparedModelDelivery'", "'./preparedModelDelivery.mjs'")
      .replaceAll("'./modelDecodeScheduler'", "'./modelDecodeScheduler.mjs'")
      .replaceAll("'./prepared-models.json'", "'./prepared-registry.mjs'");
    await writeFile(join(directory, name + '.mjs'), compiled);
  }
  const registry = await readFile(new URL('../../src/components/jade/prepared-models.json', import.meta.url), 'utf8');
  await writeFile(join(directory, 'prepared-registry.mjs'), 'export default ' + registry);
  const {default:ModelPreloader} = await import(pathToFileURL(join(directory, 'ModelPreloader.mjs')).href);
  const {assetUrl} = await import(pathToFileURL(join(directory, 'assetUrl.mjs')).href);
  return {ModelPreloader, assetUrl};
}
