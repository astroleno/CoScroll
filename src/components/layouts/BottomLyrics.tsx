"use client";

import React from 'react';
import { Text } from '@react-three/drei';
import { StackedLayoutProps } from './types';

interface BottomLyricsProps extends StackedLayoutProps {}

/**
 * 底层歌词组件 - 后两行歌词
 * 渲染在 z≈-1.2 位置，显示次要歌词内容
 */
export default function BottomLyrics(props: BottomLyricsProps) {
  const { scrollTime, duration, lyrics } = props;

  // 计算当前行索引 - 使用scrollTime确保与原版LyricsController一致
  const findCurrentLineIndex = (lyricLines: any[], time: number, durationParam: number): number => {
    if (!lyricLines || lyricLines.length === 0) return -1;
    const base = Math.max(1, durationParam || 364);
    const loopTime = time % base;
    let lineIndex = -1;
    for (let i = 0; i < lyricLines.length; i++) {
      if (lyricLines[i].time <= loopTime) {
        lineIndex = i;
      } else {
        break;
      }
    }
    return lineIndex;
  };

  const safeDuration = Math.max(1, duration);
  const currentLineIndex = findCurrentLineIndex(lyrics, scrollTime, duration);
  const currentLine = currentLineIndex >= 0 ? lyrics[currentLineIndex] : null;

  // 计算当前循环和绝对索引（用于对齐逻辑）- 与LyricsController保持一致
  const loopCount = Math.floor(scrollTime / safeDuration);
  const absoluteCurrentIndex = currentLineIndex >= 0 ? loopCount * lyrics.length + currentLineIndex : -1;
  const isLeft = absoluteCurrentIndex % 2 === 0;

  // 获取下一行歌词 - BottomLyrics显示下一行歌词
  const getNextLineTexts = () => {
    if (!currentLine || !currentLine.text) return [];

    const nextIndex = currentLineIndex + 1;
    const nextLine = nextIndex < lyrics.length ? lyrics[nextIndex] : null;

    if (nextLine && nextLine.text.trim()) {
      return [nextLine.text.trim(), null];
    }

    return [];
  };

  // 检测移动端以调整字号
  const isMobile = typeof navigator !== 'undefined' ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) : false;
  const fontSize = isMobile ? (typeof window !== 'undefined' && window.innerHeight < 667 ? 0.24 : 0.28) : 0.32; // 对应原版的1.5rem/1.8rem/2rem

  const [firstLine, secondLine] = getNextLineTexts();

  return (
    <>
      {/* 下一行歌词 - 后后层位置 */}
      {firstLine && (
        <Text
          position={[isLeft ? -1.2 : 1.2, 0.0, -1.2]} // 后后层位置，z=-1.2，增大X轴距离以匹配原版px-16
          fontSize={fontSize}
          color="#94A3B8" // 与LyricsController非当前行颜色一致
          anchorX={isLeft ? "left" : "right"} // 根据左右对齐设置锚点
          anchorY="middle"
          material-toneMapped={false}
          material-transparent={false} // 确保不透明
          material-opacity={1.0} // 完全不透明
        >
          {firstLine}
        </Text>
      )}
    </>
  );
}