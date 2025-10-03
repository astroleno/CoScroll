/**
 * LyricsSync-v3 核心类型定义
 * 基于主时钟架构和四态有限状态机的设计
 */

// 歌词数据接口
export interface Lyric {
  time: number;        // 时间戳（秒）
  text: string;        // 歌词文本
  anchor: string;      // 锚字（第一个字符）
}

// 同步状态枚举
export enum SyncState {
  AUTO_PLAY = 'AUTO_PLAY',           // 自动播放（时间→滚动）
  USER_SCRUB = 'USER_SCRUB',         // 用户滚动中（滚动→时间）
  LOOP_COOLING = 'LOOP_COOLING',     // 循环冷却期
  IDLE_AUTO = 'IDLE_AUTO'            // 过渡期，准备回到 AUTO_PLAY
}

// USER_SCRUB 子态
export enum UserScrubSubState {
  ACTIVE = 'ACTIVE',                 // 有持续滚动输入
  INERTIA = 'INERTIA'                // 惯性滚动期
}

// 吸附策略
export enum AdhesionStrategy {
  HARD = 'HARD',                     // 硬吸附
  STRONG_SOFT = 'STRONG_SOFT',       // 强软吸附
  WEAK_SOFT = 'WEAK_SOFT',           // 弱软吸附
  FREEZE = 'FREEZE'                  // 冻结
}

// 时间轴度量
export interface TimelineMetrics {
  duration: number;                  // 总时长（秒）
  lineCount: number;                 // 歌词行数
  avgLineDuration: number;           // 平均行时长
  firstLyricTime: number;            // 首句时间
  lastLyricTime: number;             // 末句时间
}

// 滚动度量
export interface ScrollMetrics {
  lineHeight: number;                // 行高（像素）
  cycleHeight: number;               // 循环高度（像素）
  visibleLineCount: number;          // 可见行数
  scrollTop: number;                 // 当前滚动位置
  maxScrollTop: number;              // 最大滚动位置
}

// 归一化滚动增量
export interface NormalizedScrollDelta {
  value: number;                     // 归一化后的滚动量
  direction: 1 | -1 | 0;             // 滚动方向
  timestamp: number;                 // 高精度时间戳
  source: 'wheel' | 'touch' | 'pointer' | 'scroll';
  velocity: number;                  // 速度估计
}

// 吸附器状态
export interface AdhesionState {
  strategy: AdhesionStrategy;        // 当前吸附策略
  error: number;                     // 当前同步误差
  targetTime: number;                // 目标时间
  isStable: boolean;                 // 是否稳定
  stableFrameCount: number;          // 稳定帧计数
}

// 性能指标
export interface PerformanceMetrics {
  // 状态转移统计
  stateTransitions: {
    [from: string]: {
      [to: string]: {
        count: number;
        avgDuration: number;
        maxDuration: number;
        totalDuration: number;
      }
    }
  };

  // 同步误差统计
  syncError: {
    p50: number;
    p95: number;
    max: number;
    samples: number[];
    lastUpdate: number;
  };

  // 渲染性能
  rendering: {
    uiDiffCount: number;
    layoutChangeCount: number;
    frameDropCount: number;
  };
}

// 配置接口
export interface LyricsSyncV3Config {
  // 吸附策略参数
  ADHESION: {
    TARGET_SETTLE_MS: number;       // 目标收敛时间
    DAMPING_RATIO: number;          // 阻尼比
    TOLERANCE: {
      HARD: number;                 // 硬吸附阈值
      SOFT_HI: number;              // 强软吸附阈值
      SOFT_LO: number;              // 弱软吸附阈值
      FREEZE: number;               // 冻结阈值
    };
    DELTA_CLAMP: {
      MAX_DT: number;               // 最大时间步长
      MIN_DT: number;               // 最小时间步长
      MAX_SCROLL_PROGRESS: number;  // 单帧最大推进时间
    };
  };

  // LOOP_COOLING 参数
  LOOP_COOLING: {
    MAIN_RATIO: number;             // 主阈值比例
    MINOR_RATIO: number;            // 次阈值比例
    BASE_DURATION: number;          // 基础冷却时长
    MIN_DURATION: number;           // 最小冷却时长
    MAX_DURATION: number;           // 最大冷却时长
    WRAP_WINDOW: number;            // wrap附近的敏感窗口
    DIRECTION_FLIP_THRESHOLD: number; // 方向反转次数阈值
  };

  // USER_SCRUB 参数
  USER_SCRUB: {
    ACTIVE_TIMEOUT: number;         // ACTIVE → INERTIA 超时
    INERTIA_DECAY_TAU: number;      // 惯性衰减时间常数
    MIN_VELOCITY: number;           // 最小速度阈值
    DIRECTION_HOLD_THRESHOLD: number; // 方向保持阈值
  };

  // 性能监控参数
  MONITORING: {
    SAMPLE_HZ: number;              // 固定采样频率
    WINDOW_MS: number;              // 统计窗口大小
    STABLE_FRAMES: number;          // 稳定性判断所需帧数
    ENABLE_PERF_LOGS: boolean;      // 性能日志开关
  };

  // 验收标准
  ACCEPTANCE: {
    SYNC_ERROR_P95: number;         // 同步误差P95阈值
    SYNC_ERROR_MAX: number;         // 同步误差最大阈值
    IDLE_TRANSITION_MS: number;     // 进入IDLE状态最大时间
    AUTO_TRANSITION_MS: number;     // 恢复AUTO状态最大时间
    MIN_DIRECTION_DELTA: number;    // 方向变化的最小有效增量
  };
}

// 音频引擎状态
export interface AudioEngineState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLooping: boolean;
  isReady: boolean;
  error: string | null;
}

// 滚动引擎状态
export interface ScrollEngineState {
  currentScrollTop: number;
  targetScrollTop: number;
  velocity: number;
  isUserScrolling: boolean;
  lastUserActionTime: number;
  lastProgrammaticScrollTime: number;
  direction: 1 | -1 | 0;
}

// 同步控制器状态
export interface SyncControllerState {
  currentState: SyncState;
  userScrubSubState: UserScrubSubState;
  displayTime: number;              // 显示时间（主时钟）
  currentLyricIndex: number;
  isLooping: boolean;
  loopStartTime: number;
  lastWrapTime: number;
  adhesionState: AdhesionState;
}

// 渲染状态
export interface RenderState {
  currentAnchor: string;
  displayedLyrics: Array<{
    index: number;
    text: string;
    isActive: boolean;
    distance: number;
  }>;
  progressPercentage: number;
  isTransitioning: boolean;
}

// 事件类型
export interface LyricsSyncV3Events {
  onStateChange: (state: SyncState, previousState: SyncState) => void;
  onLyricChange: (lyric: Lyric, index: number) => void;
  onSyncError: (error: number, strategy: AdhesionStrategy) => void;
  onLoopDetected: (wrapTime: number) => void;
  onPerformanceUpdate: (metrics: PerformanceMetrics) => void;
  onUserScroll: (data: { scrollTop: number; velocity: number }) => void;
}

// 调试面板状态
export interface DebugPanelState {
  isVisible: boolean;
  currentMetrics: PerformanceMetrics;
  configOverride: Partial<LyricsSyncV3Config>;
  isRecording: boolean;
  recordedData: Array<{
    timestamp: number;
    state: SyncState;
    displayTime: number;
    audioTime: number;
    syncError: number;
    scrollVelocity: number;
  }>;
}

// 测试脚本数据结构
export interface CalibrationScript {
  name: string;
  description: string;
  sequence: Array<{
    action: 'scroll' | 'stop' | 'oscillate' | 'seek';
    speed?: number;
    duration: number;
    targetTime?: number;
    range?: number;
    cycles?: number;
    center?: 'wrap' | 'start' | 'current';
  }>;
}

// 导出所有配置常量
export const LYRICS_SYNC_V3_CONFIG: LyricsSyncV3Config = {
  ADHESION: {
    TARGET_SETTLE_MS: 240,
    DAMPING_RATIO: 0.9,
    TOLERANCE: {
      HARD: 180,
      SOFT_HI: 50,
      SOFT_LO: 12,
      FREEZE: 8
    },
    DELTA_CLAMP: {
      MAX_DT: 33,
      MIN_DT: 8,
      MAX_SCROLL_PROGRESS: 0.5
    }
  },

  LOOP_COOLING: {
    MAIN_RATIO: 0.4,
    MINOR_RATIO: 0.2,
    BASE_DURATION: 200,
    MIN_DURATION: 100,
    MAX_DURATION: 300,
    WRAP_WINDOW: 120,
    DIRECTION_FLIP_THRESHOLD: 2
  },

  USER_SCRUB: {
    ACTIVE_TIMEOUT: 100,
    INERTIA_DECAY_TAU: 150,
    MIN_VELOCITY: 0.1,
    DIRECTION_HOLD_THRESHOLD: 0.05
  },

  MONITORING: {
    SAMPLE_HZ: 30,
    WINDOW_MS: 5000,
    STABLE_FRAMES: 3,
    ENABLE_PERF_LOGS: false
  },

  ACCEPTANCE: {
    SYNC_ERROR_P95: 25,
    SYNC_ERROR_MAX: 60,
    IDLE_TRANSITION_MS: 400,
    AUTO_TRANSITION_MS: 800,
    MIN_DIRECTION_DELTA: 0.1
  }
};