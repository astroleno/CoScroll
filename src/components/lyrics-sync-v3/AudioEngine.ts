/**
 * AudioEngine - HTML5 Audio API 封装
 * 提供统一的音频播放控制接口，作为系统的主时钟源
 */

import {
  AudioEngineState,
  LyricsSyncV3Config,
  LyricsSyncV3Events
} from './types';

export class AudioEngine {
  private audio: HTMLAudioElement;
  private state: AudioEngineState;
  private config: LyricsSyncV3Config;
  private eventListeners: Map<keyof LyricsSyncV3Events, Set<Function>> = new Map();
  private rafId: number | null = null;
  private lastUpdateTime: number = 0;
  private currentTimeUpdateInterval: number | null = null;

  constructor(audioSrc: string, config: LyricsSyncV3Config) {
    this.config = config;
    this.audio = new Audio(audioSrc);

    // 初始化状态
    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      isLooping: false,
      isReady: false,
      error: null
    };

    this.setupAudioElement();
    this.setupEventListeners();
  }

  private setupAudioElement(): void {
    // 设置音频属性
    this.audio.preload = 'metadata';
    this.audio.volume = this.state.volume;
    this.audio.loop = false; // 我们自己处理循环

    // 设置音频播放速率（用于可能的调速功能）
    this.audio.playbackRate = 1.0;

    // 设置音频解码策略
    this.audio.crossOrigin = 'anonymous';
  }

  private setupEventListeners(): void {
    // 音频元数据加载完成
    this.audio.addEventListener('loadedmetadata', () => {
      this.state.duration = this.audio.duration || 0;
      this.state.isReady = true;
      console.log('🎵 AudioEngine: 元数据加载完成', {
        duration: this.state.duration.toFixed(2),
        src: this.audio.src
      });
    });

    // 音频可以播放
    this.audio.addEventListener('canplaythrough', () => {
      console.log('🎵 AudioEngine: 音频可以完整播放');
      this.state.isReady = true;
    });

    // 音频播放错误
    this.audio.addEventListener('error', (error) => {
      this.state.error = `音频加载失败: ${error}`;
      console.error('🎵 AudioEngine: 音频错误', error);
    });

    // 音频播放结束 - 让SyncController处理循环
    this.audio.addEventListener('ended', () => {
      console.log('🎵 AudioEngine: 音频自然结束');
      this.state.isPlaying = false;
      // 不在这里处理循环，让SyncController统一管理
    });
  }

  // 获取当前状态
  public getState(): AudioEngineState {
    return { ...this.state };
  }

  // 获取当前时间（主时钟读取）
  public getCurrentTime(): number {
    return this.audio.currentTime;
  }

  // 获取总时长
  public getDuration(): number {
    return this.audio.duration || 0;
  }

  // 设置播放位置
  public seek(time: number): void {
    if (!this.state.isReady) {
      console.warn('🎵 AudioEngine: 音频未就绪，无法 seek');
      return;
    }

    const clampedTime = Math.max(0, Math.min(time, this.state.duration));

    // 降低防抖阈值，提高响应性
    if (Math.abs(clampedTime - this.state.currentTime) < 0.001) {
      return;
    }

    this.audio.currentTime = clampedTime;
    this.state.currentTime = clampedTime;

    console.log('🎵 AudioEngine: seek 到', clampedTime.toFixed(2));
  }

  // 开始播放
  public async play(): Promise<boolean> {
    if (!this.state.isReady) {
      console.warn('🎵 AudioEngine: 音频未就绪，无法播放');
      return false;
    }

    try {
      await this.audio.play();
      this.state.isPlaying = true;
      this.startHighFrequencyTimeUpdate();

      console.log('🎵 AudioEngine: 开始播放', {
        currentTime: this.audio.currentTime.toFixed(2),
        duration: this.state.duration.toFixed(2)
      });

      return true;
    } catch (error) {
      console.warn('🎵 AudioEngine: 播放失败', error);
      this.state.error = `播放失败: ${error}`;
      return false;
    }
  }

  // 暂停播放
  public pause(): void {
    this.audio.pause();
    this.state.isPlaying = false;
    this.stopHighFrequencyTimeUpdate();

    console.log('🎵 AudioEngine: 暂停播放');
  }

  // 设置音量
  public setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.audio.volume = clampedVolume;
    this.state.volume = clampedVolume;
  }

  // 设置播放速率
  public setPlaybackRate(rate: number): void {
    const clampedRate = Math.max(0.25, Math.min(4, rate));
    this.audio.playbackRate = clampedRate;
  }

  // 启动高频时间更新（替代低频的 timeupdate 事件）
  private startHighFrequencyTimeUpdate(): void {
    if (this.currentTimeUpdateInterval) {
      return;
    }

    // 使用 requestAnimationFrame 进行高频更新
    const update = () => {
      if (!this.state.isPlaying) {
        return;
      }

      const currentTime = this.audio.currentTime;
      const now = performance.now();

      // 检测时间跳跃（循环检测）
      if (this.lastUpdateTime > 0) {
        const timeDiff = currentTime - this.state.currentTime;

        // 如果时间差为负且绝对值较大，可能是循环跳跃
        if (timeDiff < -this.config.ACCEPTANCE.SYNC_ERROR_MAX / 1000) {
          console.log('🎵 AudioEngine: 检测到可能的时间跳跃', {
            from: this.state.currentTime.toFixed(2),
            to: currentTime.toFixed(2),
            diff: timeDiff.toFixed(2)
          });

          // 触发循环检测事件
          this.emit('onLoopDetected', currentTime);
        }
      }

      this.state.currentTime = currentTime;
      this.lastUpdateTime = now;

      this.rafId = requestAnimationFrame(update);
    };

    this.rafId = requestAnimationFrame(update);
  }

  // 停止高频时间更新
  private stopHighFrequencyTimeUpdate(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastUpdateTime = 0;
  }

  // 添加事件监听器
  public on<K extends keyof LyricsSyncV3Events>(
    event: K,
    listener: LyricsSyncV3Events[K]
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  // 移除事件监听器
  public off<K extends keyof LyricsSyncV3Events>(
    event: K,
    listener: LyricsSyncV3Events[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  // 触发事件
  private emit<K extends keyof LyricsSyncV3Events>(
    event: K,
    ...args: Parameters<LyricsSyncV3Events[K]>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`🎵 AudioEngine: 事件监听器错误 (${event})`, error);
        }
      });
    }
  }

  // 强制更新时间（用于外部同步）
  public forceUpdateTime(): void {
    this.state.currentTime = this.audio.currentTime;
  }

  // 检查音频是否就绪
  public isReady(): boolean {
    return this.state.isReady && this.audio.readyState >= 3; // HAVE_FUTURE_DATA
  }

  // 获取音频元素（用于高级操作）
  public getAudioElement(): HTMLAudioElement {
    return this.audio;
  }

  // 重置状态
  public reset(): void {
    this.pause();
    this.seek(0);
    this.state.error = null;
    this.lastUpdateTime = 0;
    console.log('🎵 AudioEngine: 状态已重置');
  }

  // 销毁音频引擎
  public destroy(): void {
    this.pause();
    this.stopHighFrequencyTimeUpdate();

    // 移除所有事件监听器
    this.eventListeners.clear();

    // 重置音频
    this.audio.src = '';
    this.audio.load();

    // 重置状态
    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      isLooping: false,
      isReady: false,
      error: null
    };

    console.log('🎵 AudioEngine: 已销毁');
  }

  // 获取调试信息
  public getDebugInfo(): object {
    return {
      state: this.state,
      audio: {
        readyState: this.audio.readyState,
        networkState: this.audio.networkState,
        buffered: this.audio.buffered.length > 0 ? {
          start: this.audio.buffered.start(0),
          end: this.audio.buffered.end(this.audio.buffered.length - 1)
        } : null,
        playbackRate: this.audio.playbackRate
      },
      performance: {
        rafActive: this.rafId !== null,
        lastUpdateTime: this.lastUpdateTime
      }
    };
  }
}