/**
 * 默认配置
 *
 * 从现有代码提取的默认配置，用作 fallback
 * 如果无法加载外部配置文件，将使用这些默认值
 */

import type { ProjectConfig } from './types';

/**
 * 心经项目的默认配置
 */
export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  version: '1.0.0',

  // 项目元信息
  project: {
    id: 'heart-sutra',
    name: '心经',
    description: '心经可视化项目 - 默认配置',
    author: 'CoScroll',
    createdAt: new Date().toISOString(),
  },

  // 资源配置
  assets: {
    audio: {
      src: '/audio/心经_2.mp3',
      format: 'mp3',
      duration: 374.256327,
      title: '心经',
    },
    lyrics: {
      src: '/lyrics/心经.lrc',
      format: 'lrc',
      encoding: 'utf-8',
    },
    models: {
      directory: '/models/10k_obj',
      format: 'obj',
    },
  },

  // 主题配置（从现有代码提取）
  theme: {
    // 锚字主题
    anchor: {
      primary: '#ffffff',
      glowPrimary: 'rgba(244, 114, 182, 0.3)',
      glowSecondary: 'rgba(107, 114, 255, 0.3)',
      glowIntensity: 0.3,
    },

    // 歌词主题
    lyrics: {
      current: '#f8fafc',
      adjacent: '#e5e7eb',
      nextAdjacent: '#9ca3af',
      distant: '#6b7280',
      gradientStart: 'rgba(244, 114, 182, 0.1)',
      gradientEnd: 'rgba(107, 114, 255, 0.1)',
      hoverBackground: 'rgba(244, 114, 182, 0.05)',
    },

    // 进度条主题
    progressBar: {
      background: 'rgba(107, 114, 128, 0.3)',
      completed: '#10b981',
      slider: '#ffffff',
      border: 'rgba(107, 114, 128, 0.3)',
    },

    // 背景主题
    background: {
      base: '#1f2e38',
      overlay: 'rgba(0, 0, 0, 0.5)',
      noise: true,
      noiseIntensity: 1.3,
    },
  },

  // 锚字配置（从 page.tsx 的 ANCHOR_MODEL_MAPPING 提取）
  anchors: {
    mappings: [
      {
        anchor: '观',
        modelPath: '101_观.obj',
        semanticMeaning: '起点——觉知开启',
      },
      {
        anchor: '空',
        modelPath: '001_空.obj',
        semanticMeaning: '体悟本性',
      },
      {
        anchor: '苦',
        modelPath: '045_苦.obj',
        semanticMeaning: '觉悟之因',
      },
      {
        anchor: '色',
        modelPath: '094_色.obj',
        semanticMeaning: '现象与本质统一',
      },
      {
        anchor: '法',
        modelPath: '022_法.obj',
        semanticMeaning: '法性显现',
      },
      {
        anchor: '生',
        modelPath: '019_生.obj',
        semanticMeaning: '生灭寂然',
      },
      {
        anchor: '无',
        modelPath: '012_无.obj',
        semanticMeaning: '空寂归无',
      },
      {
        anchor: '死',
        modelPath: '020_死.obj',
        semanticMeaning: '轮回消融',
      },
      {
        anchor: '道',
        modelPath: '003_道.obj',
        semanticMeaning: '八正道总摄',
      },
      {
        anchor: '心',
        modelPath: '002_心.obj',
        semanticMeaning: '安住无碍',
      },
      {
        anchor: '悟',
        modelPath: '008_悟.obj',
        semanticMeaning: '智慧圆成',
      },
      {
        anchor: '明',
        modelPath: '007_明.obj',
        semanticMeaning: '光明智慧',
      },
      {
        anchor: '真',
        modelPath: '009_真.obj',
        semanticMeaning: '终点——实相圆满',
      },
      {
        anchor: '圆',
        modelPath: '001_空.obj',
        characterId: '010',
        status: 'placeholder',
        renderedCharacter: '空',
        pendingReason: 'awaiting-acceptance',
        semanticMeaning: '圆满智慧',
      },
    ],
    defaultModel: '001_空.obj',
  },

  // 时间轴配置（从 page.tsx 的 ANCHOR_TIMELINE 提取）
  timeline: [
    { time: 11.84, anchor: '观', text: '观自在菩萨', meaning: '起点——觉知开启' },
    { time: 28.87, anchor: '空', text: '照见五蕴皆空', meaning: '体悟本性' },
    { time: 36.79, anchor: '苦', text: '度一切苦厄', meaning: '觉悟之因' },
    { time: 52.53, anchor: '色', text: '色不异空', meaning: '现象与本质统一' },
    { time: 94.09, anchor: '法', text: '是诸法空相', meaning: '法性显现' },
    { time: 98.88, anchor: '生', text: '不生不灭', meaning: '生灭寂然' },
    { time: 106.77, anchor: '无', text: '是故空中无色', meaning: '空寂归无' },
    { time: 140.50, anchor: '死', text: '乃至无老死', meaning: '轮回消融' },
    { time: 147.05, anchor: '道', text: '无苦集灭道', meaning: '八正道总摄' },
    { time: 194.10, anchor: '心', text: '心无挂碍', meaning: '安住无碍' },
    { time: 221.27, anchor: '悟', text: '得阿耨多罗三藐三菩提', meaning: '智慧圆成' },
    { time: 239.06, anchor: '明', text: '是大明咒', meaning: '光明智慧' },
    { time: 247.59, anchor: '真', text: '真实不虚', meaning: '终点——实相圆满' },
    { time: 287.91, anchor: '道', text: '故说般若波罗蜜多咒', meaning: '咒语开启' },
    { time: 322.62, anchor: '圆', text: '波罗揭谛', meaning: '圆满智慧' },
    { time: 348.83, anchor: '心', text: '菩提娑婆诃', meaning: '心性圆满' },
  ],

  // 性能配置
  performance: {
    qualityLevel: 'high',
    preloadModels: true,
    maxConcurrentLoads: 3,
    enableAdaptiveQuality: true,
  },
};
