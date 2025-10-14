export interface LyricLine {
  time: number;
  text: string;
}

export interface AudioPlayerProps {
  isPlaying: boolean;
  isReady: boolean;
  duration: number;
  currentTime: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
}

export interface LyricsControllerProps {
  lyrics: LyricLine[];
  currentTime: number;
  duration: number;
  scrollTime: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  onScrollVelocityChange?: (velocity: number) => void;
  onActiveLineChange?: (line: LyricLine | null, index: number) => void;
  onPreviewStart?: () => void;
  onPreviewTime?: (time: number) => void;
  onPreviewEnd?: () => void;
  /**
   * 可选：自定义字体族名称，用于歌词 DOM 渲染。
   * 当提供时，将覆盖组件内部的默认字体栈。
   */
  fontFamily?: string;
  /**
   * 可选：字体大小倍数，用于调整歌词显示大小。
   * 默认值为 1.0，表示使用原始大小。
   */
  fontSize?: number;
}

export interface AutoPlayGuardProps {
  onUserInteraction: () => void;
  isReady: boolean;
  isPlaying: boolean;
}
