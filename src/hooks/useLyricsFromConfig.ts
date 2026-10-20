/**
 * 从配置加载歌词
 *
 * 根据配置文件中指定的歌词路径动态加载 LRC 文件
 */

import { useState, useEffect } from 'react';
import type { LyricLine } from '@/types';
import { useAssetConfig } from '@/stores/projectConfigStore';
import { assetUrl } from '@/utils/assetUrl';

/**
 * 解析 LRC 格式歌词
 */
function parseLRC(lrcContent: string): LyricLine[] {
  const lines = lrcContent.trim().split('\n');
  const lyrics: LyricLine[] = [];

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    // 匹配 [mm:ss.xx] 格式的时间戳
    const match = trimmedLine.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      let milliseconds = parseInt(match[3]);

      // 如果是两位数，需要补零（例如 [00:11.84] 中的 84 表示 840ms）
      if (match[3].length === 2) {
        milliseconds *= 10;
      }

      const text = match[4].trim();

      // 转换为秒
      const timeInSeconds = minutes * 60 + seconds + milliseconds / 1000;

      lyrics.push({
        time: timeInSeconds,
        text,
      });
    }
  });

  // 按时间排序
  return lyrics.sort((a, b) => a.time - b.time);
}

/**
 * 从配置加载歌词的 Hook
 *
 * @returns {Object} 返回歌词数据和加载状态
 */
export function useLyricsFromConfig() {
  const assetConfig = useAssetConfig();
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[useLyricsFromConfig] useEffect 触发, assetConfig:', assetConfig);

    if (!assetConfig) {
      console.log('[useLyricsFromConfig] assetConfig 为空，设置 isLoading=false');
      setIsLoading(false);
      return;
    }

    const loadLyrics = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const lyricsPath = assetUrl(assetConfig.lyrics.src);
        console.log('[useLyricsFromConfig] 加载歌词文件:', lyricsPath);

        const response = await fetch(lyricsPath);

        if (!response.ok) {
          throw new Error(`加载歌词失败: ${response.status} ${response.statusText}`);
        }

        const lrcContent = await response.text();
        const parsedLyrics = parseLRC(lrcContent);

        console.log(`[useLyricsFromConfig] ✅ 加载成功，共 ${parsedLyrics.length} 行`);
        setLyrics(parsedLyrics);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        console.error('[useLyricsFromConfig] ❌ 加载失败:', err);
        setError(errorMessage);
        setLyrics([]); // 失败时使用空数组
      } finally {
        setIsLoading(false);
      }
    };

    loadLyrics();
  }, [assetConfig]);

  return {
    lyrics,
    isLoading,
    error,
  };
}
