/**
 * Zod 验证规则
 *
 * 这个文件定义了配置文件的运行时验证规则
 * 确保加载的 JSON 配置符合预期格式
 */

import { z } from 'zod';
import type {
  ProjectConfig,
  ProjectMeta,
  AssetConfig,
  ThemeConfig,
  AnchorConfig,
  TimelineItem,
  PerformanceConfig,
} from './types';

// ==================== 辅助验证器 ====================

/**
 * 颜色格式验证（支持 HEX 和 RGBA）
 */
const ColorSchema = z.string().refine(
  (val) => {
    // 支持 #FFFFFF 或 rgba(255, 255, 255, 0.5) 格式
    return /^(#[0-9A-Fa-f]{6}|rgba?\([\d\s,\.]+\))$/.test(val);
  },
  {
    message: '颜色必须是 #FFFFFF 或 rgba(r, g, b, a) 格式',
  }
);

/**
 * 文件路径验证
 */
const FilePathSchema = z.string().refine(
  (val) => val.startsWith('/') || val.startsWith('./') || val.startsWith('../'),
  {
    message: '文件路径必须以 / 或 ./ 或 ../ 开头',
  }
);

// ==================== 项目元信息 Schema ====================

const ProjectMetaSchema = z.object({
  id: z.string().min(1, '项目 ID 不能为空'),
  name: z.string().min(1, '项目名称不能为空'),
  description: z.string().optional(),
  author: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}) satisfies z.ZodType<ProjectMeta>;

// ==================== 资源配置 Schema ====================

const AudioConfigSchema = z.object({
  src: FilePathSchema,
  format: z.enum(['mp3', 'wav', 'ogg', 'flac']),
  duration: z.number().positive().optional(),
  title: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional(),
});

const LyricsConfigSchema = z.object({
  src: FilePathSchema,
  format: z.literal('lrc'),
  encoding: z.string().optional(),
});

const ModelsConfigSchema = z.object({
  directory: FilePathSchema,
  format: z.enum(['obj', 'glb', 'gltf']),
});

const AssetConfigSchema = z.object({
  audio: AudioConfigSchema,
  lyrics: LyricsConfigSchema,
  models: ModelsConfigSchema,
}) satisfies z.ZodType<AssetConfig>;

// ==================== 主题配置 Schema ====================

const AnchorThemeConfigSchema = z.object({
  primary: ColorSchema,
  glowPrimary: ColorSchema,
  glowSecondary: ColorSchema,
  glowIntensity: z.number().min(0).max(1),
  fontSize: z.number().positive().optional(),
});

const LyricsThemeConfigSchema = z.object({
  current: ColorSchema,
  adjacent: ColorSchema,
  nextAdjacent: ColorSchema,
  distant: ColorSchema,
  gradientStart: ColorSchema,
  gradientEnd: ColorSchema,
  hoverBackground: ColorSchema.optional(),
});

const ProgressBarThemeConfigSchema = z.object({
  background: ColorSchema,
  completed: ColorSchema,
  slider: ColorSchema,
  border: ColorSchema,
});

const BackgroundThemeConfigSchema = z.object({
  base: ColorSchema,
  overlay: ColorSchema,
  noise: z.boolean().optional(),
  noiseIntensity: z.number().min(0).max(1).optional(),
});

const ThemeConfigSchema = z.object({
  anchor: AnchorThemeConfigSchema,
  lyrics: LyricsThemeConfigSchema,
  progressBar: ProgressBarThemeConfigSchema,
  background: BackgroundThemeConfigSchema,
}) satisfies z.ZodType<ThemeConfig>;

// ==================== 锚字配置 Schema ====================

const AnchorMappingSchema = z.object({
  anchor: z.string().min(1, '锚字不能为空'),
  modelPath: z.string().min(1, '模型路径不能为空'),
  description: z.string().optional(),
  semanticMeaning: z.string().optional(),
  characterId: z.string().optional(),
  status: z.enum(['ready', 'placeholder']).optional(),
  renderedCharacter: z.string().optional(),
  pendingReason: z.enum(['pending-simplification', 'awaiting-acceptance', 'not-in-library']).optional(),
}).refine(mapping => mapping.status !== 'placeholder' || Boolean(mapping.renderedCharacter && mapping.pendingReason), {
  message: '占位模型必须注明实际显示字与占位原因',
});

const AnchorConfigSchema = z.object({
  mappings: z.array(AnchorMappingSchema).min(1, '至少需要一个锚字映射'),
  defaultModel: z.string().min(1, '默认模型不能为空'),
}) satisfies z.ZodType<AnchorConfig>;

// ==================== 时间轴配置 Schema ====================

const TimelineItemSchema = z.object({
  time: z.number().min(0, '时间必须为正数'),
  anchor: z.string().min(1, '锚字不能为空'),
  text: z.string(),
  meaning: z.string().optional(),
}) satisfies z.ZodType<TimelineItem>;

// ==================== 性能配置 Schema ====================

const PerformanceConfigSchema = z.object({
  qualityLevel: z.enum(['low', 'medium', 'high']).optional(),
  preloadModels: z.boolean().optional(),
  maxConcurrentLoads: z.number().int().positive().optional(),
  enableAdaptiveQuality: z.boolean().optional(),
}) satisfies z.ZodType<PerformanceConfig>;

const DigestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const OpeningSchema = z.object({
  text: z.string().min(12).max(64).refine(text => {
    const lines = text.split('\n');
    return lines.length >= 2 && lines.length <= 3 && lines.every(line => line.trim() === line && line.length > 0 && Array.from(line).length <= 16)
      && !/[\u0000-\u0009\u000b-\u001f\u007f<>]/.test(text);
  }, '序言须为 2–3 行，每行不超过 16 字'),
  kind: z.enum(['original', 'excerpt']),
  sourceDigest: DigestSchema,
  revision: DigestSchema,
  attribution: z.literal('AI生成 · Inko'),
  asset: z.object({
    src: z.string().regex(/^\/opening\/[a-z0-9-]+\/[a-z0-9.-]+\.png$/),
    width: z.number().int().positive().max(4096),
    height: z.number().int().positive().max(4096),
    bytes: z.number().int().positive().max(2 * 1024 * 1024),
    sha256: DigestSchema,
  }),
  manifest: z.string().regex(/^\/opening\/[a-z0-9-]+\/[a-z0-9.-]+\.json$/),
});

// ==================== 完整项目配置 Schema ====================

const ProjectConfigSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, '版本号必须是 x.y.z 格式'),
  project: ProjectMetaSchema,
  assets: AssetConfigSchema,
  theme: ThemeConfigSchema,
  anchors: AnchorConfigSchema,
  timeline: z
    .array(TimelineItemSchema)
    .min(1, '至少需要一个时间轴项')
    .refine(
      (items) => {
        // 验证时间轴按时间排序
        for (let i = 1; i < items.length; i++) {
          if (items[i].time < items[i - 1].time) {
            return false;
          }
        }
        return true;
      },
      {
        message: '时间轴项必须按时间升序排列',
      }
    ),
  performance: PerformanceConfigSchema,
  opening: OpeningSchema.optional(),
  appearance: z.object({
    background: z.literal('silk'),
    palette: z.enum(['original-jade', 'ink-green', 'warm-gold', 'violet-gray']),
    hueOffset: z.number().min(-180).max(180),
  }).optional(),
}).refine(config => {
  const anchors = new Set(config.anchors.mappings.map(mapping => mapping.anchor));
  return anchors.size === config.anchors.mappings.length && config.timeline.every(item => anchors.has(item.anchor))
    && (!config.opening || (config.opening.asset.src.startsWith(`/opening/${config.project.id}/`)
      && config.opening.manifest.startsWith(`/opening/${config.project.id}/`)));
}, {
  message: '锚字映射须完整且不重复；开场资源必须属于当前曲目',
}) satisfies z.ZodType<ProjectConfig>;

/**
 * 安全验证配置（不抛出异常）
 */
export function safeValidateProjectConfig(data: unknown): {
  success: boolean;
  data?: ProjectConfig;
  error?: z.ZodError;
} {
  const result = ProjectConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}
