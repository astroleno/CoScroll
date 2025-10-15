"use client";

import React, { useState, useEffect, useRef } from 'react';
import { LRC_LYRICS } from '@/app/constants';
// 使用现有的parseLRC函数
const parseLRC = (lrcContent: string) => {
  const lines = lrcContent.trim().split('\n');
  const lyrics: LyricLine[] = [];
  
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
      
      lyrics.push({
        time: timeInSeconds,
        text
      });
    }
  });
  
  return lyrics.sort((a, b) => a.time - b.time);
};
import UnifiedLyricsAndModel from '@/components/layouts/UnifiedLyricsAndModel';
import type { LyricLine } from '@/types';

/**
 * 统一单Canvas测试页面
 * 
 * 访问路径: /unified-test
 * 功能: 测试单Canvas架构下的真实3D遮挡关系
 */

export default function UnifiedTestPage() {
  const [currentTime, setCurrentTime] = useState(0);
  const [scrollTime, setScrollTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollVelocity, setScrollVelocity] = useState(0);
  const [currentAnchor, setCurrentAnchor] = useState('空');
  
  // 解析歌词数据
  const lyrics = parseLRC(LRC_LYRICS);
  const duration = 60; // 假设60秒循环

  // 模拟滚动控制
  const handleScroll = (delta: number) => {
    setScrollVelocity(delta * 0.1);
    setScrollTime(prev => Math.max(0, prev + delta * 0.01));
  };

  // 模拟播放控制
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // 模拟时间推进
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentTime(prev => prev + 0.1);
      setScrollTime(prev => prev + 0.1);
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // 键盘控制
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleScroll(-1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleScroll(1);
          break;
        case 'r':
          e.preventDefault();
          setCurrentTime(0);
          setScrollTime(0);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  return (
    <div className="w-full h-screen bg-gray-900 text-white overflow-hidden">
      {/* 主渲染区域 */}
      <div className="w-full h-full">
        <UnifiedLyricsAndModel
          lyrics={lyrics}
          currentTime={currentTime}
          duration={duration}
          scrollTime={scrollTime}
          isPlaying={isPlaying}
          isPreviewMode={false}
          scrollVelocity={scrollVelocity}
          currentAnchor={currentAnchor}
          onSeek={(time) => {
            setCurrentTime(time);
            setScrollTime(time);
          }}
          onScrollVelocityChange={setScrollVelocity}
          onActiveLineChange={(line, index) => {
            if (line?.text) {
              // 简单的锚字提取逻辑
              const anchor = line.text.charAt(0);
              if (['观', '空', '苦', '色', '法', '生', '无', '死', '道', '心', '悟', '明', '真', '圆'].includes(anchor)) {
                setCurrentAnchor(anchor);
              }
            }
          }}
        />
      </div>

      {/* 控制面板 */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-70 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">单Canvas测试</h2>
        <div className="space-y-2 text-sm">
          <div>时间: {currentTime.toFixed(1)}s</div>
          <div>滚动时间: {scrollTime.toFixed(1)}s</div>
          <div>状态: {isPlaying ? '播放中' : '暂停'}</div>
          <div>滚动速度: {scrollVelocity.toFixed(2)}</div>
          <div>当前锚字: {currentAnchor}</div>
        </div>
        
        <div className="mt-4 space-y-2">
          <button
            onClick={togglePlay}
            className="w-full px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            {isPlaying ? '暂停' : '播放'}
          </button>
          <button
            onClick={() => {
              setCurrentTime(0);
              setScrollTime(0);
            }}
            className="w-full px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
          >
            重置
          </button>
        </div>
      </div>

      {/* 操作说明 */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 p-4 rounded-lg text-sm">
        <h3 className="font-semibold mb-2">操作说明</h3>
        <div className="space-y-1">
          <div>空格键: 播放/暂停</div>
          <div>↑↓键: 滚动控制</div>
          <div>R键: 重置时间</div>
        </div>
        <div className="mt-3 text-xs text-gray-300">
          <div>测试重点:</div>
          <div>• 前层歌词应该显示在模型前面</div>
          <div>• 后层歌词应该被模型遮挡</div>
          <div>• 所有元素在同一3D场景中进行深度测试</div>
        </div>
      </div>
    </div>
  );
}
