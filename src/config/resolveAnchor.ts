import type { ProjectConfig } from './types';
import { assetUrl } from '@/utils/assetUrl';

/** Display, lookahead, and status copy must resolve the very same asset. */
export function resolveAnchor(anchor: string, config: ProjectConfig) {
  const mapping = config.anchors.mappings.find(item => item.anchor === anchor);
  const isPlaceholder = !mapping || mapping.status === 'placeholder';
  const renderedCharacter = mapping?.renderedCharacter ?? (isPlaceholder ? '法' : anchor);
  return {
    targetCharacter: anchor,
    renderedCharacter,
    characterId: mapping?.characterId,
    modelPath: `${assetUrl(config.assets.models.directory).replace(/\/$/, '')}/${mapping?.modelPath ?? config.anchors.defaultModel}`,
    isPlaceholder,
    pendingReason: mapping?.pendingReason ?? (isPlaceholder ? 'not-in-library' : undefined),
  };
}

export function resolveModelMappings(config: ProjectConfig): Record<string, string> {
  return Object.fromEntries([
    ['default', `${assetUrl(config.assets.models.directory).replace(/\/$/, '')}/${config.anchors.defaultModel}`],
    ...config.anchors.mappings.map(item => [item.anchor, resolveAnchor(item.anchor, config).modelPath]),
  ]);
}
