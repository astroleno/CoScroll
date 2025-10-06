"use client";

import React, { useEffect, useState } from 'react';
import { Text } from '@react-three/drei';
import { StackedLayoutProps } from './types';

interface TopLyricsProps extends StackedLayoutProps {}

/**
 * 顶层歌词组件 - 前一行歌词
 * 渲染在 z≈-1.0 位置，显示最重要的歌词内容
 */
export default function TopLyrics(props: TopLyricsProps) {
  const { scrollTime, duration, lyrics } = props;

  // 动画状态管理
  const [animatedLines, setAnimatedLines] = useState<Map<string, { opacity: number; text: string; align: string }>>(new Map());

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

  // 获取歌词行的基础属性（固定模式）
  const getLineAttributes = (lineIndex: number) => {
    if (lineIndex < 0) return { position: 'front', align: 'left' };

    // 前-后-后模式（每3行循环）
    const positionPattern = ['front', 'back', 'back'];
    const position = positionPattern[lineIndex % 3] as 'front' | 'back';

    // 左-右模式（每2行循环）
    const alignPattern = ['left', 'right'];
    const align = alignPattern[lineIndex % 2] as 'left' | 'right';

    return { position, align };
  };

  // 获取需要显示的三句歌词
  const getDisplayLines = () => {
    if (currentLineIndex < 0) return { prevLine: null, currLine: null, nextLine: null };

    const prevLine = lyrics[currentLineIndex - 1] || null;
    const currLine = lyrics[currentLineIndex] || null;
    const nextLine = lyrics[currentLineIndex + 1] || null;

    return { prevLine, currLine, nextLine };
  };

  const { prevLine, currLine, nextLine } = getDisplayLines();

  // TopLyrics只显示属性为"前"的句子（前层）
  const getFrontLines = () => {
    const result = [];

    // 检查前一句
    if (prevLine) {
      const prevAttrs = getLineAttributes(currentLineIndex - 1);
      if (prevAttrs.position === 'front') {
        result.push({ text: prevLine.text.trim(), align: prevAttrs.align, order: 'prev' });
      }
    }

    // 检查当前句
    if (currLine) {
      const currAttrs = getLineAttributes(currentLineIndex);
      if (currAttrs.position === 'front') {
        result.push({ text: currLine.text.trim(), align: currAttrs.align, order: 'curr' });
      }
    }

    // 检查后一句
    if (nextLine) {
      const nextAttrs = getLineAttributes(currentLineIndex + 1);
      if (nextAttrs.position === 'front') {
        result.push({ text: nextLine.text.trim(), align: nextAttrs.align, order: 'next' });
      }
    }

    return result;
  };

  // 检测移动端以调整字号
  const isMobile = typeof navigator !== 'undefined' ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) : false;
  const fontSize = isMobile ? (typeof window !== 'undefined' && window.innerHeight < 667 ? 0.24 : 0.28) : 0.32; // 对应原版的1.5rem/1.8rem/2rem

  const frontLines = getFrontLines();

  // 歌词变化时触发动画
  useEffect(() => {
    const newAnimatedLines = new Map();

    frontLines.forEach(line => {
      const key = `front-${line.order}`;
      const existing = animatedLines.get(key);

      if (!existing || existing.text !== line.text) {
        // 歌词变化，先淡出再淡入
        newAnimatedLines.set(key, { opacity: 0, text: line.text, align: line.align });

        // 淡入动画
        setTimeout(() => {
          setAnimatedLines(prev => {
            const updated = new Map(prev);
            updated.set(key, { ...updated.get(key)!, opacity: 1 });
            return updated;
          });
        }, 50);
      } else {
        // 保持现有状态
        newAnimatedLines.set(key, existing);
      }
    });

    // 清理不存在的行
    setAnimatedLines(newAnimatedLines);
  }, [frontLines.map(l => `${l.order}:${l.text}`).join(',')]);

  return (
    <>
      {Array.from(animatedLines.entries()).map(([key, lineData]) => {
        const [type, order] = key.split('-');
        let yPosition = 0;
        // 调整Y位置以在80vh容器中实现真正的垂直居中
        if (order === 'prev') yPosition = 1.5;  // 前一句：上方，扩展间距
        else if (order === 'curr') yPosition = 0; // 当前句：中间
        else if (order === 'next') yPosition = -1.5; // 后一句：下方，扩展间距

        return (
          <Text
            key={key}
            position={[lineData.align === 'left' ? -1.2 : 1.2, yPosition, -1.0]} // 前层位置
            fontSize={fontSize}
            color="#ffffff" // 白色，与后层保持一致
            anchorX={lineData.align === 'left' ? "left" : "right"} // 根据基础属性对齐
            anchorY="middle"
            material-toneMapped={false}
            material-transparent={true} // 启用透明度动画
            material-opacity={lineData.opacity} // 动画透明度
            depthWrite={lineData.opacity > 0.5}
            depthTest={true}
          >
            {lineData.text}
          </Text>
        );
      })}
    </>
  );
}