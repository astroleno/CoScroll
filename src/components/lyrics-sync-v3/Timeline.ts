/**
 * Timeline - 时间轴管理模块
 * 负责 LRC 解析、环形时间轴算法、二分搜索索引等功能
 */

import {
  Lyric,
  TimelineMetrics,
  LyricsSyncV3Config
} from './types';

export class Timeline {
  private lyrics: Lyric[] = [];
  private metrics: TimelineMetrics;
  private config: LyricsSyncV3Config;
  private durations: number[] = [];          // 预计算的行间时长
  private prefixSums: number[] = [];         // 预计算的前缀和
  private isDataValid: boolean = false;

  constructor(config: LyricsSyncV3Config) {
    this.config = config;
    this.metrics = {
      duration: 0,
      lineCount: 0,
      avgLineDuration: 0,
      firstLyricTime: 0,
      lastLyricTime: 0
    };
  }

  // 解析 LRC 文件内容
  public parseLRC(lrcContent: string): Lyric[] {
    const lines = lrcContent.trim().split('\n');
    const parsedLyrics: Lyric[] = [];

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // 匹配 [mm:ss.xxx] 格式的时间戳
      const match = trimmedLine.match(/^\[(\d{2}):(\d{2})\.(\d{3})\](.*)$/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = parseInt(match[3]);
        const text = match[4].trim();

        // 转换为秒
        const timeInSeconds = minutes * 60 + seconds + milliseconds / 1000;

        // 提取锚字（第一个字符），空文本则用默认字符
        const anchor = (text[0] || '观').slice(0, 1);

        parsedLyrics.push({
          time: timeInSeconds,
          text,
          anchor
        });
      }
    });

    // 按时间排序
    const sortedLyrics = parsedLyrics.sort((a, b) => a.time - b.time);

    // 设置歌词数据并重新计算度量
    this.setLyrics(sortedLyrics);

    console.log('📅 Timeline: LRC 解析完成', {
      totalLines: sortedLyrics.length,
      firstLyric: sortedLyrics[0]?.text,
      lastLyric: sortedLyrics[sortedLyrics.length - 1]?.text,
      timeSpan: sortedLyrics.length > 0
        ? (sortedLyrics[sortedLyrics.length - 1].time - sortedLyrics[0].time).toFixed(2) + 's'
        : '0s'
    });

    return sortedLyrics;
  }

  // 设置歌词数据
  public setLyrics(lyrics: Lyric[]): void {
    this.lyrics = [...lyrics]; // 创建副本
    this.calculateMetrics();
    this.preCalculateData();
    this.isDataValid = true;
  }

  // 计算时间轴度量
  private calculateMetrics(): void {
    if (this.lyrics.length === 0) {
      this.metrics = {
        duration: 0,
        lineCount: 0,
        avgLineDuration: 0,
        firstLyricTime: 0,
        lastLyricTime: 0
      };
      return;
    }

    const firstLyric = this.lyrics[0];
    const lastLyric = this.lyrics[this.lyrics.length - 1];
    const totalDuration = lastLyric.time - firstLyric.time;

    this.metrics = {
      duration: totalDuration,
      lineCount: this.lyrics.length,
      avgLineDuration: this.lyrics.length > 1 ? totalDuration / (this.lyrics.length - 1) : 0,
      firstLyricTime: firstLyric.time,
      lastLyricTime: lastLyric.time
    };

    console.log('📅 Timeline: 度量计算完成', this.metrics);
  }

  // 预计算数据（性能优化）
  private preCalculateData(): void {
    this.durations = [];
    this.prefixSums = [];

    if (this.lyrics.length < 2) {
      return;
    }

    // 计算每行的持续时间
    for (let i = 0; i < this.lyrics.length - 1; i++) {
      this.durations[i] = this.lyrics[i + 1].time - this.lyrics[i].time;
    }
    // 最后一行持续到结束（或循环）
    this.durations[this.lyrics.length - 1] = this.metrics.avgLineDuration;

    // 计算前缀和（用于 O(1) 时间映射）
    this.prefixSums[0] = 0;
    for (let i = 1; i < this.lyrics.length; i++) {
      this.prefixSums[i] = this.prefixSums[i - 1] + this.durations[i - 1];
    }
  }

  // 环形时间轴 wrap 函数
  public wrap(time: number): number {
    if (this.metrics.duration <= 0) {
      return 0;
    }

    // 将时间映射到 [firstLyricTime, firstLyricTime + duration) 区间
    const relativeTime = time - this.metrics.firstLyricTime;
    const wrappedRelativeTime = ((relativeTime % this.metrics.duration) + this.metrics.duration) % this.metrics.duration;

    return this.metrics.firstLyricTime + wrappedRelativeTime;
  }

  // 二分搜索查找时间对应的歌词索引
  public getIndexForTime(time: number): number {
    if (this.lyrics.length === 0) {
      return -1;
    }

    // 处理首句前的时间
    if (time < this.metrics.firstLyricTime) {
      return -1;
    }

    // 处理末句后的时间
    if (time >= this.metrics.lastLyricTime) {
      return this.lyrics.length - 1;
    }

    // 标准二分搜索
    let left = 0;
    let right = this.lyrics.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midTime = this.lyrics[mid].time;

      if (midTime <= time) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return Math.max(0, right);
  }

  // 高级索引搜索（处理循环边界）
  public getIndexForTimeAdvanced(time: number, checkWrapWindow: boolean = true): number {
    if (this.lyrics.length === 0) {
      return -1;
    }

    const wrappedTime = this.wrap(time);
    let baseIndex = this.getIndexForTime(wrappedTime);

    // 如果接近循环边界，检查是否需要调整
    if (checkWrapWindow && this.isNearWrapBoundary(wrappedTime)) {
      const windowThreshold = this.config.LOOP_COOLING.WRAP_WINDOW / 1000; // 转换为秒

      // 检查是否应该映射到第一句
      if (wrappedTime < this.metrics.firstLyricTime + windowThreshold) {
        return 0;
      }

      // 检查是否应该映射到最后一句
      if (wrappedTime > this.metrics.lastLyricTime - windowThreshold) {
        return this.lyrics.length - 1;
      }
    }

    return baseIndex;
  }

  // 检查时间是否接近循环边界
  public isNearWrapBoundary(time: number): boolean {
    const windowThreshold = this.config.LOOP_COOLING.WRAP_WINDOW / 1000;

    return (
      time < this.metrics.firstLyricTime + windowThreshold ||
      time > this.metrics.lastLyricTime - windowThreshold
    );
  }

  // 在两行之间进行插值
  public interpolate(index: number, progress: number): Lyric | null {
    if (this.lyrics.length === 0) {
      return null;
    }

    // 边界检查
    if (index < 0) {
      return this.lyrics[0];
    }
    if (index >= this.lyrics.length - 1) {
      return this.lyrics[this.lyrics.length - 1];
    }

    const currentLyric = this.lyrics[index];
    const nextLyric = this.lyrics[index + 1];

    // 线性插值计算时间
    const interpolatedTime = currentLyric.time + (nextLyric.time - currentLyric.time) * progress;

    return {
      time: interpolatedTime,
      text: currentLyric.text, // 文本不插值，保持当前行
      anchor: currentLyric.anchor
    };
  }

  // 计算给定时间的插值进度
  public getProgress(index: number, time: number): number {
    if (this.lyrics.length === 0 || index < 0 || index >= this.lyrics.length - 1) {
      return 0;
    }

    const currentLyric = this.lyrics[index];
    const nextLyric = this.lyrics[index + 1];
    const duration = nextLyric.time - currentLyric.time;

    if (duration <= 0) {
      return 0;
    }

    const elapsed = Math.max(0, Math.min(duration, time - currentLyric.time));
    return elapsed / duration;
  }

  // 获取循环检测阈值
  public getLoopThresholds(): { main: number; minor: number } {
    return {
      main: this.metrics.avgLineDuration * this.config.LOOP_COOLING.MAIN_RATIO,
      minor: this.metrics.avgLineDuration * this.config.LOOP_COOLING.MINOR_RATIO
    };
  }

  // 获取指定索引的歌词
  public getLyric(index: number): Lyric | null {
    if (index < 0 || index >= this.lyrics.length) {
      return null;
    }
    return this.lyrics[index];
  }

  // 获取所有歌词
  public getAllLyrics(): Lyric[] {
    return [...this.lyrics]; // 返回副本
  }

  // 获取时间轴度量
  public getMetrics(): TimelineMetrics {
    return { ...this.metrics };
  }

  // 检查数据是否有效
  public isValid(): boolean {
    return this.isDataValid && this.lyrics.length > 0;
  }

  // 获取调试信息
  public getDebugInfo(): object {
    return {
      metrics: this.metrics,
      lyricsCount: this.lyrics.length,
      dataValid: this.isDataValid,
      sampleLyrics: this.lyrics.slice(0, 3).map((lyric, index) => ({
        index,
        time: lyric.time.toFixed(2),
        text: lyric.text.slice(0, 10) + '...',
        anchor: lyric.anchor
      })),
      durations: this.durations.slice(0, 5),
      prefixSums: this.prefixSums.slice(0, 5),
      loopThresholds: this.getLoopThresholds()
    };
  }

  // 清空数据
  public clear(): void {
    this.lyrics = [];
    this.durations = [];
    this.prefixSums = [];
    this.isDataValid = false;
    this.calculateMetrics();
  }

  // 验证歌词数据完整性
  public validateData(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.lyrics.length === 0) {
      errors.push('歌词数据为空');
      return { isValid: false, errors };
    }

    // 检查时间顺序
    for (let i = 1; i < this.lyrics.length; i++) {
      if (this.lyrics[i].time < this.lyrics[i - 1].time) {
        errors.push(`歌词时间顺序错误: 第${i}行时间${this.lyrics[i].time}s早于第${i-1}行时间${this.lyrics[i-1].time}s`);
      }
    }

    // 检查锚字
    for (let i = 0; i < this.lyrics.length; i++) {
      if (!this.lyrics[i].anchor || this.lyrics[i].anchor.length === 0) {
        errors.push(`第${i}行缺少锚字`);
      }
    }

    // 检查总时长
    if (this.metrics.duration <= 0) {
      errors.push('歌词总时长无效');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}