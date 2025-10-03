/**
 * SyncController - 同步控制器
 * 负责四态有限状态机、双向同步策略、吸附器管理
 */

import {
  SyncState,
  UserScrubSubState,
  AdhesionStrategy,
  SyncControllerState,
  AdhesionState,
  PerformanceMetrics,
  TimelineMetrics,
  ScrollMetrics,
  LyricsSyncV3Config,
  LyricsSyncV3Events
} from './types';

import { AudioEngine } from './AudioEngine';
import { Timeline } from './Timeline';
import { ScrollEngine } from './ScrollEngine';

export class SyncController {
  private state: SyncControllerState;
  private config: LyricsSyncV3Config;
  private eventListeners: Map<keyof LyricsSyncV3Events, Set<Function>> = new Map();
  private rafId: number | null = null;
  private lastUpdateTime: number = 0;
  private lastAudioTime: number = 0;
  private stateTransitionStartTimes: Map<string, number> = new Map();
  private performanceMetrics: PerformanceMetrics;

  // 模块引用
  private audioEngine: AudioEngine;
  private timeline: Timeline;
  private scrollEngine: ScrollEngine;

  // 吸附器状态
  private adhesionTarget: number = 0;
  private adhesionVelocity: number = 0;
  private lastAdhesionUpdate: number = 0;

  constructor(
    audioEngine: AudioEngine,
    timeline: Timeline,
    scrollEngine: ScrollEngine,
    config: LyricsSyncV3Config
  ) {
    this.audioEngine = audioEngine;
    this.timeline = timeline;
    this.scrollEngine = scrollEngine;
    this.config = config;

    // 初始化状态
    this.state = {
      currentState: SyncState.AUTO_PLAY,
      userScrubSubState: UserScrubSubState.ACTIVE,
      displayTime: 0,
      currentLyricIndex: 0,
      isLooping: false,
      loopStartTime: 0,
      lastWrapTime: 0,
      adhesionState: {
        strategy: AdhesionStrategy.FREEZE,
        error: 0,
        targetTime: 0,
        isStable: false,
        stableFrameCount: 0
      }
    };

    // 初始化性能指标
    this.performanceMetrics = {
      stateTransitions: {},
      syncError: {
        p50: 0,
        p95: 0,
        max: 0,
        samples: [],
        lastUpdate: 0
      },
      rendering: {
        uiDiffCount: 0,
        layoutChangeCount: 0,
        frameDropCount: 0
      }
    };

    this.setupModuleListeners();
    this.startSyncLoop();
  }

  // 设置模块事件监听
  private setupModuleListeners(): void {
    // 监听音频循环事件
    this.audioEngine.on('onLoopDetected', (wrapTime: number) => {
      this.handleAudioLoop(wrapTime);
    });

    // 监听滚动事件
    this.scrollEngine.on('onUserScroll', (data: any) => {
      this.handleUserScroll(data);
    });
  }

  // 启动同步循环
  private startSyncLoop(): void {
    if (this.rafId) return;

    const syncLoop = () => {
      this.updateSync();
      this.rafId = requestAnimationFrame(syncLoop);
    };

    this.rafId = requestAnimationFrame(syncLoop);
  }

  // 停止同步循环
  private stopSyncLoop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // 主同步更新
  private updateSync(): void {
    const now = performance.now();
    const deltaTime = Math.min(
      this.config.ADHESION.DELTA_CLAMP.MAX_DT,
      Math.max(this.config.ADHESION.DELTA_CLAMP.MIN_DT, now - this.lastUpdateTime)
    );

    this.lastUpdateTime = now;

    // 获取当前音频时间
    const audioTime = this.audioEngine.getCurrentTime();

    // 检测循环跳跃
    if (this.detectLoopJump(this.lastAudioTime, audioTime)) {
      this.handleLoopJump(audioTime);
    }
    this.lastAudioTime = audioTime;

    // 检测音频结束（实现1-2-3-1-2-3循环）
    const metrics = this.timeline.getMetrics();
    const endTime = metrics.lastLyricTime - 0.5;

    if (audioTime >= endTime && this.audioEngine.getCurrentTime() > 0 && !this.state.isLooping) {
      console.log('🔄 SyncController: 检测到音频接近结束，开始循环');

      this.state.isLooping = true;

      // 重置到开始位置
      this.audioEngine.seek(metrics.firstLyricTime);
      this.state.displayTime = metrics.firstLyricTime;
      this.state.currentLyricIndex = 0;

      // 触发歌词变化事件
      const firstLyric = this.timeline.getLyric(0);
      if (firstLyric) {
        this.emit('onLyricChange', firstLyric, 0);
      }

      // 触发循环检测
      this.emit('onLoopDetected', metrics.firstLyricTime);

      // 进入冷却状态
      this.transitionToState(SyncState.LOOP_COOLING);
    }

    // 根据当前状态执行相应逻辑
    switch (this.state.currentState) {
      case SyncState.AUTO_PLAY:
        this.updateAutoPlay(audioTime, deltaTime);
        break;
      case SyncState.USER_SCRUB:
        this.updateUserScrub(audioTime, deltaTime);
        break;
      case SyncState.LOOP_COOLING:
        this.updateLoopCooling(audioTime, deltaTime);
        break;
      case SyncState.IDLE_AUTO:
        this.updateIdleAuto(audioTime, deltaTime);
        break;
    }

    // 更新歌词索引
    this.updateLyricIndex();

    // 更新性能监控
    this.updatePerformanceMetrics(audioTime);

    // 输出调试信息（开发环境）
    if (process.env.NODE_ENV === 'development' && Math.random() < 0.01) { // 1%采样率
      this.logDebugInfo();
    }
  }

  // AUTO_PLAY 状态更新
  private updateAutoPlay(audioTime: number, deltaTime: number): void {
    // 自动播放状态下，displayTime 跟随音频时间
    const wrappedAudioTime = this.timeline.wrap(audioTime);

    // 检查是否需要开始吸附
    const error = Math.abs(wrappedAudioTime - this.state.displayTime);
    const strategy = this.getAdhesionStrategy(error);

    if (strategy === AdhesionStrategy.HARD) {
      // 硬吸附
      this.state.displayTime = wrappedAudioTime;
      this.state.adhesionState.strategy = strategy;
      this.state.adhesionState.error = 0;
    } else if (strategy !== AdhesionStrategy.FREEZE) {
      // 软吸附
      this.applyAdhesion(wrappedAudioTime, deltaTime);
    } else {
      // FREEZE 状态下也要保证 displayTime 跟随音频时间，否则歌词不会更新
      this.state.displayTime = wrappedAudioTime;
    }

    // 同步滚动位置（实现音频 → 滚动的同步）
    this.syncScrollToAudioTime(this.state.displayTime);

    // 检测用户滚动
    if (this.scrollEngine.isUserScrolling()) {
      this.transitionToState(SyncState.USER_SCRUB);
    }
  }

  // USER_SCRUB 状态更新
  private updateUserScrub(audioTime: number, deltaTime: number): void {
    const scrollMetrics = this.scrollEngine.getMetrics();
    const scrollTop = scrollMetrics.scrollTop;

    // 滚动 → 时间映射
    const mappedTime = this.mapScrollToTime(scrollTop, scrollMetrics);

    // 更新 USER_SCRUB 子态
    this.updateUserScrubSubState();

    // 在 USER_SCRUB 状态下，displayTime 由滚动驱动
    this.state.displayTime = this.timeline.wrap(mappedTime);

    // 同步音频时间（单向同步）
    if (this.state.userScrubSubState === UserScrubSubState.ACTIVE) {
      this.audioEngine.seek(this.state.displayTime);
    }

    // 检查是否应该退出 USER_SCRUB
    if (!this.scrollEngine.isUserScrolling()) {
      this.transitionToState(SyncState.IDLE_AUTO);
    }
  }

  // LOOP_COOLING 状态更新
  private updateLoopCooling(audioTime: number, deltaTime: number): void {
    const now = performance.now();
    const coolingDuration = now - this.state.loopStartTime;

    // 冷却期间只允许单向吸附（音频 → 显示）
    const wrappedAudioTime = this.timeline.wrap(audioTime);
    this.applyAdhesion(wrappedAudioTime, deltaTime, true); // 强制单向吸附

    // 检查冷却是否结束
    const thresholds = this.timeline.getLoopThresholds();
    const targetCoolingDuration = this.calculateCoolingDuration(
      Math.abs(this.state.lastWrapTime - wrappedAudioTime),
      thresholds
    );

    if (coolingDuration >= targetCoolingDuration) {
      console.log('🔄 SyncController: 冷却期结束，恢复自动播放');
      this.state.isLooping = false;
      this.transitionToState(SyncState.AUTO_PLAY);

      // 如果音频停止了，重新开始播放
      if (!this.audioEngine.getState().isPlaying) {
        this.audioEngine.play().then(success => {
          if (success) {
            console.log('🎵 SyncController: 循环后自动恢复播放');
          }
        });
      }
    }
  }

  // IDLE_AUTO 状态更新
  private updateIdleAuto(audioTime: number, deltaTime: number): void {
    const wrappedAudioTime = this.timeline.wrap(audioTime);
    const error = Math.abs(wrappedAudioTime - this.state.displayTime);

    // 应用吸附策略
    const strategy = this.getAdhesionStrategy(error);
    this.state.adhesionState.strategy = strategy;

    if (strategy === AdhesionStrategy.HARD) {
      // 硬吸附并立即回到 AUTO_PLAY
      this.state.displayTime = wrappedAudioTime;
      this.state.adhesionState.error = 0;
      this.transitionToState(SyncState.AUTO_PLAY);
    } else if (strategy === AdhesionStrategy.FREEZE) {
      // 检查是否稳定
      this.state.adhesionState.stableFrameCount++;
      if (this.state.adhesionState.stableFrameCount >= this.config.MONITORING.STABLE_FRAMES) {
        this.transitionToState(SyncState.AUTO_PLAY);
      }
    } else {
      // 软吸附
      this.state.adhesionState.stableFrameCount = 0;
      this.applyAdhesion(wrappedAudioTime, deltaTime);
    }

    // 如果用户开始滚动，回到 USER_SCRUB
    if (this.scrollEngine.isUserScrolling()) {
      this.transitionToState(SyncState.USER_SCRUB);
    }
  }

  // 更新 USER_SCRUB 子态
  private updateUserScrubSubState(): void {
    const now = performance.now();
    const timeSinceLastAction = now - this.scrollEngine.getState().lastUserActionTime;
    const velocity = this.scrollEngine.getState().velocity;

    if (timeSinceLastAction < this.config.USER_SCRUB.ACTIVE_TIMEOUT) {
      this.state.userScrubSubState = UserScrubSubState.ACTIVE;
    } else if (Math.abs(velocity) > this.config.USER_SCRUB.MIN_VELOCITY) {
      this.state.userScrubSubState = UserScrubSubState.INERTIA;
    } else {
      // 保持当前状态，等待状态机决定转移
    }
  }

  // 滚动 → 时间映射
  public mapScrollToTime(scrollTop: number, scrollMetrics: ScrollMetrics): number {
    const timelineMetrics = this.timeline.getMetrics();
    if (!timelineMetrics.lineCount || scrollMetrics.lineHeight <= 0) {
      return 0;
    }

    // 计算行索引和进度
    const lineHeight = scrollMetrics.lineHeight;
    const rawIndex = scrollTop / lineHeight;
    const index = Math.floor(rawIndex);
    const progress = rawIndex - index;

    // 边界检查
    const clampedIndex = Math.max(0, Math.min(timelineMetrics.lineCount - 1, index));

    // 获取当前行和下一行的时间
    const currentLyric = this.timeline.getLyric(clampedIndex);
    const nextLyric = this.timeline.getLyric(clampedIndex + 1);

    if (!currentLyric) {
      return timelineMetrics.firstLyricTime;
    }

    if (!nextLyric) {
      // 最后一行，使用平均持续时间
      const avgDuration = timelineMetrics.avgLineDuration;
      return currentLyric.time + progress * avgDuration;
    }

    // 线性插值
    const currentLyricTime = currentLyric.time;
    const nextLyricTime = nextLyric.time;
    const duration = nextLyricTime - currentLyricTime;

    return currentLyricTime + progress * duration;
  }

  // 时间 → 滚动映射
  private mapTimeToScroll(time: number, scrollMetrics: ScrollMetrics): number {
    const timelineMetrics = this.timeline.getMetrics();
    if (!timelineMetrics.lineCount || scrollMetrics.lineHeight <= 0) {
      return 0;
    }

    const index = this.timeline.getIndexForTime(time);
    if (index < 0) {
      return 0;
    }

    const progress = this.timeline.getProgress(index, time);
    const lineHeight = scrollMetrics.lineHeight;

    return (index + progress) * lineHeight;
  }

  // 同步滚动位置到音频时间（实现音频 → 滚动同步）
  private syncScrollToAudioTime(displayTime: number): void {
    const scrollMetrics = this.scrollEngine.getMetrics();
    const scrollTop = this.mapTimeToScroll(displayTime, scrollMetrics);

    // 避免频繁的滚动更新
    const currentScrollTop = this.scrollEngine.getCurrentScrollTop();
    if (Math.abs(scrollTop - currentScrollTop) > scrollMetrics.lineHeight * 0.1) {
      this.scrollEngine.scrollToPosition(scrollTop);
    }
  }

  // 应用吸附策略
  private applyAdhesion(targetTime: number, deltaTime: number, forceOneWay: boolean = false): void {
    const error = targetTime - this.state.displayTime;
    const absError = Math.abs(error);
    const strategy = this.getAdhesionStrategy(absError);

    this.state.adhesionState.error = error;
    this.state.adhesionState.targetTime = targetTime;

    if (strategy === AdhesionStrategy.FREEZE || absError < this.config.ADHESION.TOLERANCE.FREEZE / 1000) {
      // 冻结状态
      this.state.adhesionState.isStable = true;
      return;
    }

    this.state.adhesionState.isStable = false;

    if (strategy === AdhesionStrategy.HARD || absError > this.config.ADHESION.TOLERANCE.HARD / 1000) {
      // 硬吸附
      this.state.displayTime = targetTime;
    } else {
      // 软吸附（弹簧模型）
      this.applySpringAdhesion(targetTime, deltaTime);
    }
  }

  // 弹簧吸附
  private applySpringAdhesion(targetTime: number, deltaTime: number): void {
    const damping = this.config.ADHESION.DAMPING_RATIO;
    const targetSettleTime = this.config.ADHESION.TARGET_SETTLE_MS / 1000; // 转换为秒

    // 计算弹簧刚度
    const omega = 2 * Math.PI / targetSettleTime;
    const k = omega * omega;
    const c = 2 * damping * omega;

    // 弹簧力计算
    const error = targetTime - this.state.displayTime;
    const springForce = k * error;
    const dampingForce = c * this.adhesionVelocity;

    const acceleration = springForce - dampingForce;
    this.adhesionVelocity += acceleration * deltaTime;

    // 更新显示时间
    this.state.displayTime += this.adhesionVelocity * deltaTime;
  }

  // 获取吸附策略
  private getAdhesionStrategy(error: number): AdhesionStrategy {
    const errorMs = Math.abs(error) * 1000; // 转换为毫秒

    if (errorMs > this.config.ADHESION.TOLERANCE.HARD) {
      return AdhesionStrategy.HARD;
    } else if (errorMs > this.config.ADHESION.TOLERANCE.SOFT_HI) {
      return AdhesionStrategy.STRONG_SOFT;
    } else if (errorMs > this.config.ADHESION.TOLERANCE.SOFT_LO) {
      return AdhesionStrategy.WEAK_SOFT;
    } else {
      return AdhesionStrategy.FREEZE;
    }
  }

  // 检测循环跳跃
  private detectLoopJump(prevTime: number, currentTime: number): boolean {
    const thresholds = this.timeline.getLoopThresholds();
    const timeDiff = currentTime - prevTime;

    return timeDiff < -thresholds.minor;
  }

  // 处理循环跳跃
  private handleLoopJump(audioTime: number): void {
    console.log('🔄 SyncController: 检测到循环跳跃', {
      from: this.lastAudioTime.toFixed(2),
      to: audioTime.toFixed(2)
    });

    // 实现真正的循环：1-2-3-1-2-3 模式
    // 当音频接近结束时，自动跳转到开始位置
    const metrics = this.timeline.getMetrics();
    const endTime = metrics.lastLyricTime;
    const startTime = metrics.firstLyricTime;

    // 如果当前时间接近结束，自动跳转到开始
    if (audioTime < startTime + 1.0) { // 在开始位置1秒内
      console.log('🔄 SyncController: 检测到循环重新开始，实现 1-2-3-1-2-3 模式');

      // 重置显示时间到开始位置
      this.state.displayTime = startTime;
      this.state.currentLyricIndex = 0;

      // 触发歌词变化事件
      const firstLyric = this.timeline.getLyric(0);
      if (firstLyric) {
        this.emit('onLyricChange', firstLyric, 0);
      }
    }

    this.state.lastWrapTime = audioTime;
    this.transitionToState(SyncState.LOOP_COOLING);
  }

  // 处理音频循环事件
  private handleAudioLoop(wrapTime: number): void {
    if (this.state.currentState !== SyncState.LOOP_COOLING) {
      console.log('🔄 SyncController: 音频引擎检测到循环', wrapTime.toFixed(2));
      this.handleLoopJump(wrapTime);
    }
  }

  // 处理用户滚动
  private handleUserScroll(data: any): void {
    if (this.state.currentState === SyncState.AUTO_PLAY) {
      this.transitionToState(SyncState.USER_SCRUB);
    }
  }

  // 计算冷却时长
  private calculateCoolingDuration(timeDiff: number, thresholds: { main: number; minor: number }): number {
    const ratio = Math.min(1, Math.max(0, timeDiff / thresholds.main));
    return this.config.LOOP_COOLING.MIN_DURATION +
           ratio * (this.config.LOOP_COOLING.MAX_DURATION - this.config.LOOP_COOLING.MIN_DURATION);
  }

  // 状态转移
  private transitionToState(newState: SyncState): void {
    const oldState = this.state.currentState;
    if (oldState === newState) return;

    const now = performance.now();
    const transitionKey = `${oldState}_${newState}`;

    // 记录状态转移
    if (!this.performanceMetrics.stateTransitions[oldState]) {
      this.performanceMetrics.stateTransitions[oldState] = {};
    }
    if (!this.performanceMetrics.stateTransitions[oldState][newState]) {
      this.performanceMetrics.stateTransitions[oldState][newState] = {
        count: 0,
        avgDuration: 0,
        maxDuration: 0,
        totalDuration: 0
      };
    }

    const transitionMetrics = this.performanceMetrics.stateTransitions[oldState][newState];
    const previousStartTime = this.stateTransitionStartTimes.get(oldState) || now;
    const duration = now - previousStartTime;

    transitionMetrics.count++;
    transitionMetrics.totalDuration += duration;
    transitionMetrics.avgDuration = transitionMetrics.totalDuration / transitionMetrics.count;
    transitionMetrics.maxDuration = Math.max(transitionMetrics.maxDuration, duration);

    this.stateTransitionStartTimes.set(newState, now);

    // 执行状态转移逻辑
    this.executeStateTransition(oldState, newState);

    // 更新状态
    this.state.currentState = newState;

    // 触发事件
    this.emit('onStateChange', newState, oldState);

    console.log('🔄 SyncController: 状态转移', oldState, '→', newState);
  }

  // 执行状态转移逻辑
  private executeStateTransition(fromState: SyncState, toState: SyncState): void {
    switch (toState) {
      case SyncState.USER_SCRUB:
        // 进入用户滚动状态
        this.state.userScrubSubState = UserScrubSubState.ACTIVE;
        break;

      case SyncState.IDLE_AUTO:
        // 进入过渡状态
        this.state.adhesionState.stableFrameCount = 0;
        break;

      case SyncState.LOOP_COOLING:
        // 进入冷却状态
        this.state.isLooping = true;
        this.state.loopStartTime = performance.now();
        break;

      case SyncState.AUTO_PLAY:
        // 进入自动播放状态
        this.state.adhesionState.stableFrameCount = 0;
        this.adhesionVelocity = 0;
        break;
    }
  }

  // 更新歌词索引
  private updateLyricIndex(): void {
    const newIndex = this.timeline.getIndexForTimeAdvanced(this.state.displayTime);
    if (newIndex !== this.state.currentLyricIndex && newIndex >= 0) {
      this.state.currentLyricIndex = newIndex;

      const lyric = this.timeline.getLyric(newIndex);
      if (lyric) {
        this.emit('onLyricChange', lyric, newIndex);
      }
    }
  }

  // 更新性能指标
  private updatePerformanceMetrics(audioTime: number): void {
    const now = performance.now();
    const sampleInterval = 1000 / this.config.MONITORING.SAMPLE_HZ; // 采样间隔

    if (now - this.performanceMetrics.syncError.lastUpdate >= sampleInterval) {
      const error = Math.abs(audioTime - this.state.displayTime) * 1000; // 转换为毫秒
      const samples = this.performanceMetrics.syncError.samples;

      samples.push(error);
      if (samples.length > this.config.MONITORING.WINDOW_MS / sampleInterval) {
        samples.shift();
      }

      // 计算统计指标
      samples.sort((a, b) => a - b);
      this.performanceMetrics.syncError.p50 = samples[Math.floor(samples.length * 0.5)];
      this.performanceMetrics.syncError.p95 = samples[Math.floor(samples.length * 0.95)];
      this.performanceMetrics.syncError.max = Math.max(...samples);
      this.performanceMetrics.syncError.lastUpdate = now;

      // 检查是否超出验收标准
      if (this.performanceMetrics.syncError.p95 > this.config.ACCEPTANCE.SYNC_ERROR_P95) {
        this.emit('onSyncError', this.performanceMetrics.syncError.p95, this.state.adhesionState.strategy);
      }
    }
  }

  // 获取当前状态
  public getState(): SyncControllerState {
    return { ...this.state };
  }

  // 获取性能指标
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  // 手动设置状态（用于测试）
  public setState(state: SyncState): void {
    this.transitionToState(state);
  }

  // 重置控制器
  public reset(): void {
    this.state.displayTime = 0;
    this.state.currentLyricIndex = 0;
    this.state.isLooping = false;
    this.state.userScrubSubState = UserScrubSubState.ACTIVE;
    this.adhesionVelocity = 0;

    this.transitionToState(SyncState.AUTO_PLAY);
    console.log('🔄 SyncController: 已重置');
  }

  // 事件监听器
  public on<K extends keyof LyricsSyncV3Events>(
    event: K,
    listener: LyricsSyncV3Events[K]
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  public off<K extends keyof LyricsSyncV3Events>(
    event: K,
    listener: LyricsSyncV3Events[K]
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

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
          console.error(`🔄 SyncController: 事件监听器错误 (${event})`, error);
        }
      });
    }
  }

  // 调试日志
  private logDebugInfo(): void {
    console.log('🔄 SyncController 调试信息', {
      state: this.state.currentState,
      displayTime: this.state.displayTime.toFixed(2),
      audioTime: this.audioEngine.getCurrentTime().toFixed(2),
      syncError: (this.audioEngine.getCurrentTime() - this.state.displayTime * 1000).toFixed(2) + 'ms',
      userScrubSubState: this.state.userScrubSubState,
      isLooping: this.state.isLooping,
      adhesionStrategy: this.state.adhesionState.strategy,
      performance: {
        syncErrorP95: this.performanceMetrics.syncError.p95.toFixed(2) + 'ms',
        stateTransitions: Object.keys(this.performanceMetrics.stateTransitions).length
      }
    });
  }

  // 获取详细调试信息
  public getDebugInfo(): object {
    return {
      state: this.state,
      performanceMetrics: this.performanceMetrics,
      modules: {
        audioEngine: this.audioEngine.getDebugInfo(),
        timeline: this.timeline.getDebugInfo(),
        scrollEngine: this.scrollEngine.getDebugInfo()
      },
      config: this.config
    };
  }

  // 启动同步控制器
  public start(): void {
    if (!this.rafId) {
      console.log('🔄 SyncController: 启动同步循环');
      this.startSyncLoop();
    }
  }

  // 销毁控制器
  public destroy(): void {
    this.stopSyncLoop();
    this.eventListeners.clear();
    this.stateTransitionStartTimes.clear();
    console.log('🔄 SyncController: 已销毁');
  }
}