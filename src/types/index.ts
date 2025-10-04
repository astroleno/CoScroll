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
}

export interface AutoPlayGuardProps {
  onUserInteraction: () => void;
  isReady: boolean;
  isPlaying: boolean;
}
