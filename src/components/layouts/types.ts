/**
 * 布局类型定义
 */

export type LyricsLayout = 'front-back-back' | 'stacked-3canvas';

export interface LayoutProps {
  layout: LyricsLayout;
}

export interface StackedLayoutProps {
  // 音频相关状态
  currentTime: number;
  scrollTime: number;
  duration: number;
  isPlaying: boolean;

  // 锚字相关
  currentAnchor: string;

  // 歌词数据
  lyrics: any[];

  // 事件回调
  onSeek: (absoluteTime: number) => void;
  onScrollVelocityChange: (velocity: number) => void;

  // 滚动速度（来自LyricsController）
  scrollVelocity: number;

  // 模型相关
  modelPreloadStatus: {
    isPreloading: boolean;
    loaded: number;
    total: number;
    currentModel: string;
    nextModel: string;
  };
}