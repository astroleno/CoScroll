/**
 * ScrollEngine - 滚动引擎模块
 * 负责滚动输入归一化、连续滚动数学映射、无限循环视觉效果
 */

import {
  ScrollMetrics,
  NormalizedScrollDelta,
  ScrollEngineState,
  LyricsSyncV3Config,
  LyricsSyncV3Events
} from './types';

export class ScrollEngine {
  private state: ScrollEngineState;
  private config: LyricsSyncV3Config;
  private eventListeners: Map<keyof LyricsSyncV3Events, Set<Function>> = new Map();
  private containerRef: HTMLElement | null = null;
  private rafId: number | null = null;
  private velocityHistory: number[] = [];
  private directionHistory: (1 | -1 | 0)[] = [];
  private lastScrollEventTime: number = 0;
  private accumulatedDelta: number = 0;
  private isNormalizing: boolean = false;

  // 行高配置
  private LINE_HEIGHT = 3.2 * 16; // 3.2rem * 16px (CSS px)
  private VISIBLE_LINE_COUNT = 5;

  constructor(config: LyricsSyncV3Config) {
    this.config = config;
    this.state = {
      currentScrollTop: 0,
      targetScrollTop: 0,
      velocity: 0,
      isUserScrolling: false,
      lastUserActionTime: 0,
      lastProgrammaticScrollTime: 0,
      direction: 0
    };

    this.bindMethods();
  }

  private bindMethods(): void {
    this.handleWheel = this.handleWheel.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.animationLoop = this.animationLoop.bind(this);
  }

  // 设置滚动容器
  public setContainer(element: HTMLElement): void {
    this.containerRef = element;
    this.setupEventListeners();
    this.updateMetrics();
  }

  // 设置事件监听器
  private setupEventListeners(): void {
    if (!this.containerRef) return;

    // 滚轮事件（桌面端）
    this.containerRef.addEventListener('wheel', this.handleWheel, { passive: true });

    // 触摸事件（移动端）
    this.containerRef.addEventListener('touchmove', this.handleTouchMove, { passive: true });

    // 指针事件（通用）
    this.containerRef.addEventListener('pointermove', this.handlePointerMove, { passive: true });

    // 滚动事件（容器滚动）
    this.containerRef.addEventListener('scroll', this.handleScroll, { passive: true });

    // 启动动画循环
    this.startAnimationLoop();

    console.log('📜 ScrollEngine: 事件监听器已设置');
  }

  // 移除事件监听器
  public removeEventListeners(): void {
    if (!this.containerRef) return;

    this.containerRef.removeEventListener('wheel', this.handleWheel);
    this.containerRef.removeEventListener('touchmove', this.handleTouchMove);
    this.containerRef.removeEventListener('pointermove', this.handlePointerMove);
    this.containerRef.removeEventListener('scroll', this.handleScroll);

    this.stopAnimationLoop();
    console.log('📜 ScrollEngine: 事件监听器已移除');
  }

  // 处理滚轮事件
  private handleWheel(event: WheelEvent): void {
    if (!this.isUserScrollAllowed()) return;

    const now = performance.now();
    const deltaTime = now - this.lastScrollEventTime;

    // 限制处理频率
    if (deltaTime < 8) return; // 最大125Hz

    this.lastScrollEventTime = now;

    // 归一化滚轮增量
    const delta = this.normalizeWheelDelta(event.deltaY);
    const normalizedDelta: NormalizedScrollDelta = {
      value: delta,
      direction: delta > 0 ? 1 : delta < 0 ? -1 : 0,
      timestamp: now,
      source: 'wheel',
      velocity: Math.abs(delta / Math.max(1, deltaTime)) * 1000 // 像素/秒
    };

    this.processScrollDelta(normalizedDelta);
  }

  // 处理触摸移动事件
  private handleTouchMove(event: TouchEvent): void {
    if (!this.isUserScrollAllowed() || event.touches.length !== 1) return;

    const now = performance.now();
    const deltaTime = now - this.lastScrollEventTime;

    if (deltaTime < 16) return; // 限制到60Hz

    this.lastScrollEventTime = now;

    // 计算触摸移动增量
    const touch = event.touches[0];
    const deltaY = touch.clientY; // 简化处理，实际应该追踪移动差值
    const delta = this.normalizeTouchDelta(deltaY);

    const normalizedDelta: NormalizedScrollDelta = {
      value: delta,
      direction: delta > 0 ? 1 : delta < 0 ? -1 : 0,
      timestamp: now,
      source: 'touch',
      velocity: Math.abs(delta / Math.max(1, deltaTime)) * 1000
    };

    this.processScrollDelta(normalizedDelta);
  }

  // 处理指针移动事件
  private handlePointerMove(event: PointerEvent): void {
    if (!this.isUserScrollAllowed() || event.pointerType !== 'mouse') return;

    const now = performance.now();
    const deltaTime = now - this.lastScrollEventTime;

    if (deltaTime < 16) return;

    this.lastScrollEventTime = now;

    const delta = this.normalizePointerDelta(event.movementY);
    const normalizedDelta: NormalizedScrollDelta = {
      value: delta,
      direction: delta > 0 ? 1 : delta < 0 ? -1 : 0,
      timestamp: now,
      source: 'pointer',
      velocity: Math.abs(delta / Math.max(1, deltaTime)) * 1000
    };

    this.processScrollDelta(normalizedDelta);
  }

  // 处理容器滚动事件
  private handleScroll(event: Event): void {
    if (!this.containerRef || this.isNormalizing) return;

    const now = performance.now();
    const currentScrollTop = this.containerRef.scrollTop;
    const scrollDelta = Math.abs(currentScrollTop - this.state.currentScrollTop);

    // 忽略程序触发的滚动
    const timeSinceLastProgrammatic = now - this.state.lastProgrammaticScrollTime;
    if (timeSinceLastProgrammatic < 100) {
      return;
    }

    // 标记为用户滚动
    if (scrollDelta > 0.5) {
      this.state.isUserScrolling = true;
      this.state.lastUserActionTime = now;

      // 计算滚动速度
      const deltaTime = Math.max(1, now - this.lastScrollEventTime);
      this.state.velocity = scrollDelta / deltaTime * 1000;
      this.state.direction = currentScrollTop > this.state.currentScrollTop ? 1 : -1;

      // 更新历史记录
      this.updateVelocityHistory(this.state.velocity);
      this.updateDirectionHistory(this.state.direction);

      this.emit('onUserScroll', {
        scrollTop: currentScrollTop,
        velocity: this.state.velocity
      });
    }

    this.state.currentScrollTop = currentScrollTop;

    // 检查是否需要归一化
    this.checkNormalizationNeeded(currentScrollTop);
  }

  // 处理滚动增量
  private processScrollDelta(delta: NormalizedScrollDelta): void {
    // 应用增量钳制
    const clampedDelta = this.clampScrollDelta(delta);

    // 累积增量
    this.accumulatedDelta += clampedDelta.value;

    // 更新速度和方向
    this.state.velocity = clampedDelta.velocity;
    this.state.direction = clampedDelta.direction;
    this.state.isUserScrolling = true;
    this.state.lastUserActionTime = clampedDelta.timestamp;

    // 更新历史记录
    this.updateVelocityHistory(clampedDelta.velocity);
    this.updateDirectionHistory(clampedDelta.direction);

    // 应用滚动
    this.applyScrollDelta(clampedDelta);
  }

  // 归一化滚轮增量
  private normalizeWheelDelta(deltaY: number): number {
    // 限制单次滚动的最大增量
    const maxDelta = this.LINE_HEIGHT * 2; // 最多2行
    return Math.max(-maxDelta, Math.min(maxDelta, deltaY));
  }

  // 归一化触摸增量
  private normalizeTouchDelta(deltaY: number): number {
    // 触摸事件的归一化处理
    return Math.max(-this.LINE_HEIGHT, Math.min(this.LINE_HEIGHT, deltaY * 0.5));
  }

  // 归一化指针增量
  private normalizePointerDelta(deltaY: number): number {
    // 指针事件的归一化处理
    return Math.max(-this.LINE_HEIGHT * 0.5, Math.min(this.LINE_HEIGHT * 0.5, deltaY));
  }

  // 增量钳制
  private clampScrollDelta(delta: NormalizedScrollDelta): NormalizedScrollDelta {
    const maxProgress = this.config.ADHESION.DELTA_CLAMP.MAX_SCROLL_PROGRESS * this.LINE_HEIGHT;
    const clampedValue = Math.max(-maxProgress, Math.min(maxProgress, delta.value));

    return {
      ...delta,
      value: clampedValue,
      velocity: Math.abs(clampedValue / Math.max(1, delta.timestamp - this.lastScrollEventTime)) * 1000
    };
  }

  // 应用滚动增量
  private applyScrollDelta(delta: NormalizedScrollDelta): void {
    if (!this.containerRef) return;

    const newScrollTop = this.state.currentScrollTop + delta.value;
    this.state.targetScrollTop = newScrollTop;

    // 标记为程序滚动（避免滚动事件循环）
    this.state.lastProgrammaticScrollTime = performance.now();
    this.isNormalizing = true;

    // 直接设置滚动位置
    this.containerRef.scrollTop = newScrollTop;

    // 重置归一化标志
    requestAnimationFrame(() => {
      this.isNormalizing = false;
    });
  }

  // 更新速度历史
  private updateVelocityHistory(velocity: number): void {
    this.velocityHistory.push(velocity);
    if (this.velocityHistory.length > 10) {
      this.velocityHistory.shift();
    }
  }

  // 更新方向历史
  private updateDirectionHistory(direction: 1 | -1 | 0): void {
    this.directionHistory.push(direction);
    if (this.directionHistory.length > 5) {
      this.directionHistory.shift();
    }
  }

  // 检查是否需要归一化
  private checkNormalizationNeeded(scrollTop: number): void {
    if (!this.containerRef) return;

    const metrics = this.getMetrics();
    const maxScrollTop = metrics.maxScrollTop;

    // 检查是否越界
    if (scrollTop < -100 || scrollTop > maxScrollTop + 100) {
      this.normalizeScrollPosition();
    }
  }

  // 归一化滚动位置
  private normalizeScrollPosition(): void {
    if (!this.containerRef) return;

    const metrics = this.getMetrics();
    const maxScrollTop = metrics.maxScrollTop;
    const currentScrollTop = this.containerRef.scrollTop;

    let normalizedScrollTop = currentScrollTop;

    // 向下越界
    if (currentScrollTop > maxScrollTop + 100) {
      normalizedScrollTop = maxScrollTop;
    }
    // 向上越界
    else if (currentScrollTop < -100) {
      normalizedScrollTop = 0;
    }

    if (normalizedScrollTop !== currentScrollTop) {
      this.state.lastProgrammaticScrollTime = performance.now();
      this.containerRef.scrollTop = normalizedScrollTop;
      this.state.currentScrollTop = normalizedScrollTop;
      this.state.targetScrollTop = normalizedScrollTop;

      console.log('📜 ScrollEngine: 滚动位置已归一化', {
        from: currentScrollTop,
        to: normalizedScrollTop
      });
    }
  }

  // 动画循环（用于平滑滚动和惯性处理）
  private animationLoop(): void {
    const now = performance.now();
    const deltaTime = now - this.state.lastUserActionTime;

    // 检查是否应该停止用户滚动状态
    if (this.state.isUserScrolling && deltaTime > this.config.USER_SCRUB.ACTIVE_TIMEOUT) {
      // 检查是否有惯性
      const avgVelocity = this.getAverageVelocity();
      if (Math.abs(avgVelocity) > this.config.USER_SCRUB.MIN_VELOCITY) {
        // 应用惯性衰减
        this.applyInertiaDecay(avgVelocity);
      } else {
        // 停止用户滚动
        this.state.isUserScrolling = false;
        this.state.velocity = 0;
        this.accumulatedDelta = 0;
      }
    }

    // 平滑滚动到目标位置
    if (Math.abs(this.state.targetScrollTop - this.state.currentScrollTop) > 0.1) {
      const easeFactor = 0.15;
      const newScrollTop = this.state.currentScrollTop +
        (this.state.targetScrollTop - this.state.currentScrollTop) * easeFactor;

      if (this.containerRef && !this.isNormalizing) {
        this.containerRef.scrollTop = newScrollTop;
        this.state.currentScrollTop = newScrollTop;
      }
    }

    this.rafId = requestAnimationFrame(this.animationLoop);
  }

  // 应用惯性衰减
  private applyInertiaDecay(velocity: number): void {
    const tau = this.config.USER_SCRUB.INERTIA_DECAY_TAU / 1000; // 转换为秒
    const decayFactor = Math.exp(-1 / 60 / tau); // 60fps下的衰减因子

    const newVelocity = velocity * decayFactor;
    const delta = newVelocity / 60; // 每帧的位移

    this.state.velocity = newVelocity;
    this.state.targetScrollTop += delta;
  }

  // 启动动画循环
  private startAnimationLoop(): void {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(this.animationLoop);
  }

  // 停止动画循环
  private stopAnimationLoop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // 获取平均速度
  private getAverageVelocity(): number {
    if (this.velocityHistory.length === 0) return 0;
    const sum = this.velocityHistory.reduce((a, b) => a + b, 0);
    return sum / this.velocityHistory.length;
  }

  // 检查方向反转
  public checkDirectionFlip(): boolean {
    if (this.directionHistory.length < 3) return false;

    const recent = this.directionHistory.slice(-3);
    let flipCount = 0;

    for (let i = 1; i < recent.length; i++) {
      if (recent[i] !== 0 && recent[i-1] !== 0 && recent[i] !== recent[i-1]) {
        flipCount++;
      }
    }

    return flipCount >= this.config.LOOP_COOLING.DIRECTION_FLIP_THRESHOLD;
  }

  // 检查用户是否正在滚动
  public isUserScrolling(): boolean {
    const now = performance.now();
    const timeSinceLastAction = now - this.state.lastUserActionTime;
    return this.state.isUserScrolling && timeSinceLastAction < 500;
  }

  // 检查用户滚动是否被允许
  private isUserScrollAllowed(): boolean {
    const now = performance.now();
    const timeSinceLastProgrammatic = now - this.state.lastProgrammaticScrollTime;
    return timeSinceLastProgrammatic > 200; // 200ms冷却期
  }

  // 滚动到指定位置
  public scrollToPosition(scrollTop: number, smooth: boolean = false): void {
    if (!this.containerRef) return;

    this.state.targetScrollTop = scrollTop;
    this.state.lastProgrammaticScrollTime = performance.now();

    if (smooth) {
      // 平滑滚动
      this.containerRef.style.scrollBehavior = 'smooth';
      this.containerRef.scrollTop = scrollTop;
      setTimeout(() => {
        if (this.containerRef) {
          this.containerRef.style.scrollBehavior = 'auto';
        }
      }, 300);
    } else {
      // 立即滚动
      this.containerRef.scrollTop = scrollTop;
    }

    this.state.currentScrollTop = scrollTop;
  }

  // 根据歌词索引滚动
  public scrollToLyricIndex(index: number, lineHeight: number): void {
    // 计算居中位置（让当前歌词显示在中间）
    const centerOffset = (this.VISIBLE_LINE_COUNT - 1) / 2;
    const scrollTop = Math.max(0, (index - centerOffset) * lineHeight);
    this.scrollToPosition(scrollTop);
    console.log('📜 ScrollEngine: 滚动到歌词索引', { index, scrollTop });
  }

  // 根据时间位置滚动（用于音频同步）
  public scrollToTime(currentTime: number, timeline: any): void {
    if (!timeline) return;

    const index = timeline.getIndexForTime(currentTime);
    if (index >= 0) {
      const metrics = this.getMetrics();
      this.scrollToLyricIndex(index, metrics.lineHeight);
    }
  }

  // 获取当前滚动位置
  public getCurrentScrollTop(): number {
    return this.state.currentScrollTop;
  }

  // 获取滚动度量
  public getMetrics(): ScrollMetrics {
    const maxScrollTop = this.containerRef
      ? Math.max(0, this.containerRef.scrollHeight - this.containerRef.clientHeight)
      : 0;

    return {
      lineHeight: this.LINE_HEIGHT,
      cycleHeight: this.LINE_HEIGHT * 100, // 假设100行一个循环
      visibleLineCount: this.VISIBLE_LINE_COUNT,
      scrollTop: this.state.currentScrollTop,
      maxScrollTop
    };
  }

  // 更新度量（在容器尺寸变化时调用）
  public updateMetrics(): void {
    if (!this.containerRef) return;

    // 重新计算行高等参数
    const computedStyle = getComputedStyle(this.containerRef);
    const fontSize = parseFloat(computedStyle.fontSize);
    this.LINE_HEIGHT = 3.2 * fontSize;

    console.log('📜 ScrollEngine: 度量已更新', {
      lineHeight: this.LINE_HEIGHT,
      containerHeight: this.containerRef.clientHeight,
      scrollHeight: this.containerRef.scrollHeight
    });
  }

  // 获取当前状态
  public getState(): ScrollEngineState {
    return { ...this.state };
  }

  // 重置状态
  public reset(): void {
    this.state = {
      currentScrollTop: 0,
      targetScrollTop: 0,
      velocity: 0,
      isUserScrolling: false,
      lastUserActionTime: 0,
      lastProgrammaticScrollTime: 0,
      direction: 0
    };

    this.velocityHistory = [];
    this.directionHistory = [];
    this.accumulatedDelta = 0;

    if (this.containerRef) {
      this.containerRef.scrollTop = 0;
    }

    console.log('📜 ScrollEngine: 状态已重置');
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
          console.error(`📜 ScrollEngine: 事件监听器错误 (${event})`, error);
        }
      });
    }
  }

  // 获取调试信息
  public getDebugInfo(): object {
    return {
      state: this.state,
      metrics: this.getMetrics(),
      history: {
        velocity: this.velocityHistory.slice(-5),
        direction: this.directionHistory.slice(-5)
      },
      accumulatedDelta: this.accumulatedDelta,
      isNormalizing: this.isNormalizing,
      hasContainer: !!this.containerRef
    };
  }

  // 销毁
  public destroy(): void {
    this.removeEventListeners();
    this.eventListeners.clear();
    this.velocityHistory = [];
    this.directionHistory = [];
    this.containerRef = null;
    console.log('📜 ScrollEngine: 已销毁');
  }
}