import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_CATALOG } from './catalog';
import { safeValidateProjectConfig } from './schema';
import { parseLRC } from './lyrics';
import { resolveAnchor } from './resolveAnchor';
import { assetUrl } from '@/utils/assetUrl';
import prepared from '@/components/jade/prepared-models.json';
import type { EntryData } from './entryBootstrap';

export function createEntryBootstrap() {
  const data: EntryData = {version: 1, release: process.env.COSCROLL_RELEASE_ID || 'development', projects: {}};
  const hints: Record<string, {model: string; audio: string; supplement: boolean}> = {};
  for (const {id} of PROJECT_CATALOG) {
    const result = safeValidateProjectConfig(JSON.parse(readFileSync(join(process.cwd(), 'public/projects', id + '.json'), 'utf8')));
    if (!result.success) throw new Error(`Invalid entry project: ${id}`);
    const config = result.data!;
    const lyrics = readFileSync(join(process.cwd(), 'public', config.assets.lyrics.src), 'utf8');
    parseLRC(lyrics);
    data.projects[id] = {config, lyrics};
    const model = resolveAnchor(config.timeline[0].anchor, config).modelPath;
    const record = prepared.models.find(item => assetUrl(item.sourcePath) === model);
    hints[id] = {model: record ? assetUrl(record.preparedPath) : model, audio: assetUrl(config.assets.audio.src), supplement: lyrics.includes('栴')};
  }
  return {data, hints};
}
