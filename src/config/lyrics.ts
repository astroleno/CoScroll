import type { LyricLine } from '@/types';

export function parseLRC(content: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const row of content.split(/\r?\n/)) {
    const match = row.trim().match(/^\[(\d{2,}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/);
    if (!match) continue;
    const seconds = Number(match[2]);
    if (seconds >= 60) throw new Error('歌词时间戳中的秒数必须小于 60');
    lines.push({time: Number(match[1]) * 60 + seconds + Number((match[3] ?? '').padEnd(3, '0')) / 1000,
      text: match[4].trim()});
  }
  if (!lines.some(line => line.text)) throw new Error('歌词文件没有有效唱词');
  return lines.sort((a, b) => a.time - b.time);
}
