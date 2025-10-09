import React from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
// 可选依赖：@react-three/postprocessing（若未安装则自动跳过Bloom）
let Post: any = null; try { Post = require('@react-three/postprocessing'); } catch {}
import { LRC_LYRICS } from '@/constants';
import { getScreenAnchoredPosition } from '@/scenes/simple/utils/positionUtils';

// 组件属性：
// - audioRef: 外部音频引用，用于驱动时间轴
// - distance: 距离相机的距离（米）
// - baseOffsetX/Y: 文本相对中心的偏移，方便在画面中上/下/左右布局

type Props = {
  audioRef: React.RefObject<HTMLAudioElement>;
  distance?: number; // 距相机距离
  baseOffsetX?: number;
  baseOffsetY?: number;
  // 是否启用连续滚动模式：'legacy' 保持原先五行离散排布；'scroll' 连续滚动
  // URL 可用 ?lyricsmode=scroll 覆盖此配置
  scrollMode?: 'legacy' | 'scroll';
  // 连续滚动模式下，可视窗口上下各渲染几行（总行数约= 2*windowLines+1）
  windowLines?: number;
  // 滚动类型：byline=按行时长，constant=常速（不依赖音频播放）
  scrollType?: 'byline' | 'constant';
  // 常速滚动时，每秒滚过的“行数”（行/秒）。例如 0.5 表示 2 秒一行
  constantLinesPerSecond?: number;
  // 视觉速度缩放：前景/后景行的位移缩放系数（近快远慢）。仅影响渲染位移，不改变时间轴
  frontParallaxScale?: number; // 默认 1.1（前景稍快）
  backParallaxScale?: number;  // 默认 0.9（后景稍慢）
};

type Line = { time: number; text: string };

function parseLRCFirstN(lrc: string, n: number): Line[] {
  const lines = lrc.split(/\r?\n/);
  const out: Line[] = [];
  for (const line of lines) {
    const m = line.match(/^\[(\d{2}):([0-5]\d(?:\.\d{1,3})?)\]([\s\S]*)$/);
    if (!m) continue;
    const min = parseInt(m[1], 10) || 0;
    const sec = parseFloat(m[2]) || 0;
    const time = min * 60 + sec;
    const text = (m[3] || '').trim();
    if (!text) continue;
    out.push({ time, text });
    if (out.length >= n) break;
  }
  // 保证按时间排序
  return out.sort((a, b) => a.time - b.time);
}

// 解析整段 LRC（全部行，按时间排序）
function parseLRCAll(lrc: string): Line[] {
  const lines = (lrc || '').split(/\r?\n/);
  const outRaw: Line[] = [];
  for (const line of lines) {
    const m = line.match(/^\[(\d{2}):([0-5]\d(?:\.\d{1,3})?)\]([\s\S]*)$/);
    if (!m) continue;
    const min = parseInt(m[1], 10) || 0;
    const sec = parseFloat(m[2]) || 0;
    const time = min * 60 + sec;
    const text = (m[3] || '').trim();
    if (!text) continue;
    outRaw.push({ time, text });
  }
  // 排序
  const sorted = outRaw.sort((a, b) => a.time - b.time);
  // 去重/微偏移：相邻时间戳相等时，为后者加极小偏移，避免定位时命中两行
  const EPS = 0.01; // 10ms
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].time - sorted[i - 1].time) < 1e-6) {
      sorted[i].time = sorted[i - 1].time + EPS;
    }
  }
  return sorted;
}

export default function Lyrics3DOverlay({ audioRef, distance = 8, baseOffsetX = 1.6, baseOffsetY = 0.8, scrollMode = 'legacy', windowLines = 6, scrollType = 'byline', constantLinesPerSecond = 0.35, frontParallaxScale = 1.1, backParallaxScale = 0.9 }: Props) {
  const { camera, scene, invalidate } = useThree() as any;
  // URL 可调参数：字体大小、偏移、深度系数
  const url = React.useMemo(() => new URLSearchParams(location.search), []);
  const uiFontSize = React.useMemo(() => parseFloat(url.get('lyricsfs') || '') || NaN, [url]); // 字号覆盖: ?lyricsfs=0.56
  const uiOffsetX = React.useMemo(() => parseFloat(url.get('lyricsdx') || '') || NaN, [url]);  // 左右距离: ?lyricsdx=1.85
  const uiOffsetY = React.useMemo(() => parseFloat(url.get('lyricsdy') || '') || NaN, [url]);  // 上下行距: ?lyricsdy=0.92
  const uiDzScale = React.useMemo(() => parseFloat(url.get('lyricsdz') || '') || NaN, [url]);  // 前后层次强度: ?lyricsdz=1.8
  const uiMode = React.useMemo(() => (url.get('lyricsmode') || '').toLowerCase(), [url]); // 模式: legacy|scroll
  const uiWindow = React.useMemo(() => parseInt(url.get('lyricswin') || '', 10), [url]); // 窗口行数
  const uiScrollType = React.useMemo(() => (url.get('lyricstype') || '').toLowerCase(), [url]); // byline|constant
  const uiConstLps = React.useMemo(() => parseFloat(url.get('lyricslps') || ''), [url]); // 每秒行数
  const uiFrontScale = React.useMemo(() => parseFloat(url.get('lyricsfront') || ''), [url]); // 前景缩放
  const uiBackScale = React.useMemo(() => parseFloat(url.get('lyricsback') || ''), [url]);   // 后景缩放
  const effectiveOffsetX = isNaN(uiOffsetX) ? baseOffsetX : uiOffsetX; // 左右距离默认=baseOffsetX，可被 URL 覆盖
  const effectiveOffsetY = isNaN(uiOffsetY) ? baseOffsetY : uiOffsetY; // 行距默认=baseOffsetY，可被 URL 覆盖
  const effectiveMode: 'legacy' | 'scroll' = uiMode === 'scroll' ? 'scroll' : scrollMode;
  const effectiveWindowLines = Number.isFinite(uiWindow) && uiWindow! > 0 ? (uiWindow as number) : windowLines;
  const effectiveScrollType: 'byline' | 'constant' = uiScrollType === 'constant' ? 'constant' : scrollType;
  const effectiveConstLps = Number.isFinite(uiConstLps) && !isNaN(uiConstLps!) && uiConstLps! > 0 ? (uiConstLps as number) : constantLinesPerSecond;
  const effectiveFrontScale = Number.isFinite(uiFrontScale) && !isNaN(uiFrontScale!) && uiFrontScale! > 0 ? (uiFrontScale as number) : frontParallaxScale;
  const effectiveBackScale = Number.isFinite(uiBackScale) && !isNaN(uiBackScale!) && uiBackScale! > 0 ? (uiBackScale as number) : backParallaxScale;
  const data = React.useMemo(() => {
    try {
      const parsed = parseLRCAll(LRC_LYRICS || '');
      if (parsed.length > 0) return parsed;
    } catch {}
    // 兜底：提供简短占位文案，确保可见
    return [
      { time: 0, text: '但愿人长久' },
      { time: 2, text: '千里共婵娟' },
      { time: 4, text: '明月几时有' },
      { time: 6, text: '把酒问青天' },
      { time: 8, text: '不知天上宫阙' },
      { time: 10, text: '今夕是何年' }
    ];
  }, []);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  // 连续滚动插值：scroll = idx + fraction，采用阻尼平滑
  const scrollRef = React.useRef(0); // 当前渲染使用的连续滚动值
  const targetScrollRef = React.useRef(0); // 由音频时间计算得到的目标滚动值
  const startedRef = React.useRef(false); // 常速滚动首次对齐标记
  // byline 智能兜底：若音频不可用/暂停/缓冲过久，则临时切到常速，恢复后再回到 byline
  const autoConstantRef = React.useRef(false);
  const stalledMsRef = React.useRef(0);
  const STALL_THRESHOLD_MS = 350; // 超过该时长视为停滞，切到常速
  const RECOVER_THRESHOLD_MS = 150; // 恢复阈值，低于该时长回到 byline
  // 触发 React 重新渲染的nonce（使得基于 scrollRef 的 JSX 位置更新生效）
  const [renderNonce, setRenderNonce] = React.useState(0);
  const lastRenderedScrollRef = React.useRef(0);
  const lastNonceTimeRef = React.useRef(0);
  const MIN_NONCE_INTERVAL_MS = 16; // 节流触发渲染的最小间隔

  // 在某些视图（例如特写）里，r3f 可能使用 frameloop="demand"，导致 useFrame 不自动推进。
  // 这里增加一个 rAF 兜底时钟：持续推进滚动并主动 invalidate()，保证连续动画。
  const rafIdRef = React.useRef<number | null>(null);
  const lastTsRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (effectiveMode !== 'scroll') return;
    const tick = (ts: number) => {
      try {
        const last = lastTsRef.current;
        lastTsRef.current = ts;
        const delta = last ? Math.max(0, (ts - last) / 1000) : 0;
        // 与 useFrame 相同的推进逻辑（简化版）：
        const ref = audioRef.current ?? localAudioRef.current ?? (document.querySelector('audio') as HTMLAudioElement | null);
        const t = ref && !isNaN(ref.currentTime) ? ref.currentTime : 0;
        // 定位当前行
        let lo = 0, hi = data.length - 1, idx = 0;
        const EPS = 0.02;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (t + EPS >= data[mid].time) { idx = mid; lo = mid + 1; } else { hi = mid - 1; }
        }
        // 即时兜底：推进优先
        const playable = !!ref && ref.readyState >= 2 && !ref.seeking;
        const advancing = playable && !ref.paused;
        if (effectiveScrollType === 'byline' && advancing) {
          const cur = data[idx];
          const nxt = data[idx + 1] ?? cur;
          const seg = Math.max(0.001, (nxt.time - cur.time) || 0.001);
          const frac = THREE.MathUtils.clamp((t - cur.time) / seg, 0, 1);
          targetScrollRef.current = idx + frac;
          scrollRef.current = THREE.MathUtils.damp(scrollRef.current, targetScrollRef.current, 6, delta || 0.016);
        } else {
          if (!startedRef.current) {
            scrollRef.current = idx;
            targetScrollRef.current = idx;
            startedRef.current = true;
          }
          const advance = effectiveConstLps * (delta || 0.016);
          scrollRef.current += advance;
          targetScrollRef.current = scrollRef.current;
        }
        // 节流触发 React 刷新 + 请求一帧渲染
        try {
          const now = performance.now();
          if (Math.abs(scrollRef.current - lastRenderedScrollRef.current) > 0.001 && (now - lastNonceTimeRef.current) > MIN_NONCE_INTERVAL_MS) {
            lastRenderedScrollRef.current = scrollRef.current;
            lastNonceTimeRef.current = now;
            setRenderNonce(n => (n + 1) & 0xffff);
          }
          invalidate && invalidate();
        } catch {}
      } catch {}
      rafIdRef.current = window.requestAnimationFrame(tick);
    };
    rafIdRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      lastTsRef.current = null;
    };
  }, [effectiveMode, effectiveScrollType, effectiveConstLps, audioRef, data]);
  // 调试：挂载时打印一次
  React.useEffect(() => {
    try {
      console.log('[Lyrics3DOverlay] mounted, lines=', data.length, { mode: effectiveMode, type: effectiveScrollType, lps: effectiveConstLps, frontScale: effectiveFrontScale, backScale: effectiveBackScale });
      console.log('[Lyrics3DOverlay] url.search=', location.search);
    } catch {}
  }, [data.length, effectiveMode, effectiveScrollType, effectiveConstLps, effectiveFrontScale, effectiveBackScale]);

  // 简单动画相位（用于上下轻微浮动和缩放）
  const animRef = React.useRef(0);

  const localAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  // 监听音频播放/暂停，只有播放时才推进歌词（严格绑定传入的 audioRef，不再兜底 querySelector）
  React.useEffect(() => {
    const el = audioRef.current ?? (document.querySelector('audio') as HTMLAudioElement | null);
    if (!(el instanceof HTMLAudioElement)) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsPlaying(false);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('ended', onPause);
    setIsPlaying(!el.paused);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('ended', onPause);
    };
  }, [audioRef]);
  useFrame((_, delta) => {
    try {
      // 兜底：若外部未传入 audioRef，尝试获取页面上的 <audio>
      const ref = audioRef.current ?? localAudioRef.current ?? (document.querySelector('audio') as HTMLAudioElement | null);
      const t = ref && !isNaN(ref.currentTime) ? ref.currentTime : 0;
      // 二分查找：找到最后一个 time <= t 的索引
      let lo = 0, hi = data.length - 1, idx = 0;
      const EPS = 0.02; // 20ms 容差
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (t + EPS >= data[mid].time) { idx = mid; lo = mid + 1; } else { hi = mid - 1; }
      }
      if (idx !== currentIndex) setCurrentIndex(idx);

      if (effectiveMode === 'scroll') {
        // 计算是否音频处于“可推进”状态
        const playable = !!ref && ref.readyState >= 2 && !ref.seeking;
        const advancing = playable && !ref.paused;
        // 改为“即时兜底”：只要不在推进，就直接按常速推进；推进时再按行时长
        if (effectiveScrollType === 'byline' && advancing) {
          // 按行时长：依赖 audio 时间
          const cur = data[idx];
          const nxt = data[idx + 1] ?? cur;
          const seg = Math.max(0.001, (nxt.time - cur.time) || 0.001);
          const frac = THREE.MathUtils.clamp((t - cur.time) / seg, 0, 1);
          const target = idx + frac;
          targetScrollRef.current = target;
          scrollRef.current = THREE.MathUtils.damp(scrollRef.current, targetScrollRef.current, 6, delta);
        } else {
          // 常速模式：与音频解耦，持续滚动（行/秒）
          if (!startedRef.current) {
            // 首帧：若能拿到音频时间，则从对应行对齐，否则从 0 对齐
            scrollRef.current = idx;
            targetScrollRef.current = idx;
            startedRef.current = true;
          }
          const advance = effectiveConstLps * delta; // 本帧推进的“行数”
          scrollRef.current += advance;
          targetScrollRef.current = scrollRef.current;
        }
      }

      // 节流触发 React 刷新，确保特写/按需帧下也能更新位置
      try {
        const now = performance.now();
        if (Math.abs(scrollRef.current - lastRenderedScrollRef.current) > 0.001 && (now - lastNonceTimeRef.current) > MIN_NONCE_INTERVAL_MS) {
          lastRenderedScrollRef.current = scrollRef.current;
          lastNonceTimeRef.current = now;
          setRenderNonce(n => (n + 1) & 0xffff);
        }
      } catch {}

      // 关闭呼吸动画：不再累积相位
      // animRef.current += delta;
    } catch {}
  });

  // 将歌词组放置在相机前方 distance，并参与遮挡关系（深度写入）
  const groupRef = React.useRef<THREE.Group>(null);
  useFrame(() => {
    if (!groupRef.current) return;
    // 使用与月球一致的“屏幕锚定”方法，保证在客户端放大特写时也能稳定显示
    // 将歌词放在屏幕正中偏上位置，并且基于月球实际大小决定前/后偏移量
    let anchorDistance = 15; // 作为兜底
    let moonDistance = 15;
    let moonApproxRadius = 0.8; // 兜底估计
    try {
      const moon = scene.getObjectByName('moonMesh') as THREE.Object3D | undefined;
      if (moon) {
        // 通过相机到月球实际距离估算一个更靠后的距离
        const moonPos = new THREE.Vector3();
        moon.getWorldPosition(moonPos);
        const dist = camera.position.distanceTo(moonPos);
        moonDistance = dist;
        anchorDistance = dist; // 基线放在月球距离
        // 估算月球世界半径（用于决定前后偏移）
        const mesh = moon as any;
        const geo = mesh.geometry as THREE.BufferGeometry | undefined;
        const scale = new THREE.Vector3();
        moon.getWorldScale(scale);
        if (geo && geo.boundingSphere) {
          moonApproxRadius = geo.boundingSphere.radius * Math.max(scale.x, scale.y, scale.z);
        }
      }
    } catch {}
    const target = getScreenAnchoredPosition(0.5, 0.57, anchorDistance, camera as THREE.PerspectiveCamera); // 整体Y锚点=0.62 (0~1，越大越靠下)
    groupRef.current.position.copy(target);
    groupRef.current.quaternion.copy(camera.quaternion); // billboard：面向相机

    // 轻微上下浮动与缩放（不影响可读性）
    // 保持固定缩放，避免呼吸效果
    groupRef.current.scale.setScalar(1.0);

    // 调试：低频打印位置（每 ~1.5s）
    if (Math.floor(animRef.current * (1/1.5)) !== Math.floor((animRef.current - (1/60)) * (1/1.5))) {
      try {
        const p = groupRef.current.position;
        console.log('[Lyrics3DOverlay] pos', { x:+p.x.toFixed(2), y:+p.y.toFixed(2), z:+p.z.toFixed(2), dist: +camera.position.distanceTo(p).toFixed(2) });
      } catch {}
    }
  });

  const hasPrev = currentIndex > 0;
  const prev = hasPrev ? data[currentIndex - 1] : undefined;
  const cur = data[currentIndex];
  // 边界处理：最后一行时不渲染“下一行”，避免与当前行重复
  const next = currentIndex + 1 < data.length ? data[currentIndex + 1] : undefined;

  const forceFront = false; // 不再使用URL置前

  // 固有属性：
  // - 左右: 按绝对索引交替（偶=左，奇=右）
  // - 前后: 循环 [前, 后, 后]（索引 % 3 => 0=前, 1=后, 2=后）
  // 四象限独立X偏移（单位：米）——可分别调“前左/前右/后左/后右”的水平位置
  const FRONT_LEFT_X  = 3;  // 前+左 的左右距离 ← 改这里
  const FRONT_RIGHT_X = 3;  // 前+右 的左右距离 ← 改这里
  const BACK_LEFT_X   = 2.5;  // 后+左 的左右距离 ← 改这里
  const BACK_RIGHT_X  = 2.5;  // 后+右 的左右距离 ← 改这里
  const sideX = (idx: number) => { // 根据“前/后 + 左/右”返回X位置
    const isLeft = (idx % 2 === 0);              // 偶=左，奇=右（与行号一致）
    const isFront = (((idx % 3) + 3) % 3) === 0; // 0=前，1/2=后
    const dist = isFront
      ? (isLeft ? FRONT_LEFT_X : FRONT_RIGHT_X)
      : (isLeft ? BACK_LEFT_X  : BACK_RIGHT_X);
    return (isLeft ? -1 : 1) * dist;
  };
  // 判定“前/后”，返回缩放比例（近大远小）
  // 你可以直接调整 frontScale / backScale 两个数值
  const scaleFor = (idx: number) => { // 近大远小：改 frontScale/backScale
    const m = ((idx % 3) + 3) % 3; // 0=前, 1=后, 2=后
    const frontScale = 1.08;      // 前（近）放大 ← 调这里
    const backScale  = 0.88;      // 后（远）缩小 ← 调这里
    return m === 0 ? frontScale : backScale;
  };
  // 四象限独立对齐（left/right）——可分别调“前左/前右/后左/后右”的对齐方式
  const FRONT_LEFT_ANCHOR: 'left'|'right'  = 'left';  // 前+左 对齐 ← 改这里
  const FRONT_RIGHT_ANCHOR: 'left'|'right' = 'right'; // 前+右 对齐 ← 改这里
  const BACK_LEFT_ANCHOR: 'left'|'right'   = 'left';  // 后+左 对齐 ← 改这里
  const BACK_RIGHT_ANCHOR: 'left'|'right'  = 'right'; // 后+右 对齐 ← 改这里
  const anchorFor = (idx: number): 'left' | 'right' => { // 左右对齐策略（四象限独立控制）
    const isLeft = (idx % 2 === 0);
    const isFront = (((idx % 3) + 3) % 3) === 0;
    if (isFront) return isLeft ? FRONT_LEFT_ANCHOR : FRONT_RIGHT_ANCHOR;
    return isLeft ? BACK_LEFT_ANCHOR : BACK_RIGHT_ANCHOR;
  };
  // 前/后层次：基于绝对索引循环 前(-dz)、后(+dz)、后(+dz)
  // 前/后层次：可分别设置“前/后”的深度系数
  const FRONT_DZ_SCALE = 1.1; // 前（近）深度系数：越大越靠近相机 ← 改这里
  const BACK_DZ_SCALE  = 1.1; // 后（远）深度系数：越大越远离相机 ← 改这里
  const zShift = (idx: number) => {
    const m = ((idx % 3) + 3) % 3;
    // dz 与月球实际可见半径相关，保证足够“在前/在后”
  const baseR = (typeof (window as any).__MOON_RADIUS_WORLD === 'number' ? (window as any).__MOON_RADIUS_WORLD : 1.0);
  const scale = m === 0 ? FRONT_DZ_SCALE : BACK_DZ_SCALE; // 前用 FRONT_DZ_SCALE，后用 BACK_DZ_SCALE
  const dz = Math.max(0.6, baseR * scale + 0.2);
    return m === 0 ? -dz : +dz;
  };

  // 额外的前/后垂直补偿（近大远小造成的视觉补偿）
  const FRONT_EXTRA_Y = 0.06; // 前（近）额外上移量（米，正值=向上）← 改这里
  const BACK_EXTRA_Y  = -0.03; // 后（远）额外下移量（米，负值=向下）← 改这里
  const extraY = (idx: number) => (((idx % 3) + 3) % 3) === 0 ? FRONT_EXTRA_Y : BACK_EXTRA_Y;

  // 逻辑空行（不渲染，只通过位移体现“空一/两行”的视觉效果）
  // 前层通常需要更大的空间，让“近大”不会挤压；后层可较小
  const FRONT_GAP_LINES = 0; // 前层每级额外“空行数” ← 改这里（0/1/2）
  const BACK_GAP_LINES  = 0; // 后层每级额外“空行数” ← 改这里（0/1/2）
  const gapFor = (idx: number) => ((((idx % 3) + 3) % 3) === 0 ? FRONT_GAP_LINES : BACK_GAP_LINES);
  // 将距离级数 n（上2行=2、上1行=1、下1行=1、下2行=2）放大为 n + gap*n
  const mul = (n: number, idx: number) => n + gapFor(idx) * n;

  // 屏幕等距：把“希望在屏幕上等距”的行距换算为世界偏移
  // 目标屏幕行距（NDC，高度分数）；0.08≈每行占屏幕高8%
  const SCREEN_SPACING_NDC = 0.08; // ← 改这里（0.06~0.12常用）
  const worldStepFromScreen = (dist: number) => {
    try {
      const persp = camera as THREE.PerspectiveCamera;
      const fov = (persp && 'fov' in persp) ? (persp as THREE.PerspectiveCamera).fov : 50;
      const k = Math.tan(THREE.MathUtils.degToRad(fov / 2));
      // 近似换算：NDC行距 * 距离 * tan(FOV/2) * 2
      return SCREEN_SPACING_NDC * dist * k * 2;
    } catch { return SCREEN_SPACING_NDC * dist * 0.5; }
  };
  const distForIndex = (idx: number) => {
    try {
      if (!groupRef.current) return camera.position.length();
      const p = groupRef.current.position;
      const linePos = new THREE.Vector3(p.x, p.y, p.z + zShift(idx));
      return camera.position.distanceTo(linePos);
    } catch { return camera.position.length(); }
  };
  // 多级（±1、±2级）世界偏移：按等距换算 + 逻辑空行倍增
  const worldStepLevels = (levels: number, idx: number) => {
    const dist = distForIndex(idx);
    const base = worldStepFromScreen(dist);
    const factor = (1 + gapFor(idx));
    return levels * base * factor;
  };

  // 统一字号（当前行不放大），仅颜色强调当前行
  const fontSize = 0.5; // 基础字号 ← 改这里
  const tuneMaterial = (obj: any) => {
    try {
      const mat = obj?.material;
      if (mat) {
        mat.depthTest = true;
        mat.depthWrite = true;
        mat.transparent = true;
        mat.needsUpdate = true;
      }
    } catch {}
  };
  const colorFor = (idx: number) => (idx === currentIndex ? '#ffffff' : '#a8a8a8');

  // 渲染：根据模式选择 legacy（五行离散）或 scroll（窗口连续滚动）
  return (
    <group ref={groupRef} renderOrder={forceFront ? 2000 : 200} key={renderNonce}>
      {/* 发光后处理：若已安装 @react-three/postprocessing 才渲染 */}
      {Post && (
        <Post.EffectComposer disableNormalPass multisampling={0}>
          <Post.Bloom luminanceThreshold={0.82} luminanceSmoothing={0.15} intensity={2.0} radius={0.35} mipmapBlur />
        </Post.EffectComposer>
      )}

      {effectiveMode === 'legacy' && (
        <>
           {currentIndex > 1 && data[currentIndex - 2] && (
            <Text
               position={[sideX(currentIndex - 2), worldStepLevels(2, currentIndex - 2) + extraY(currentIndex - 2), zShift(currentIndex - 2)]}
              fontSize={fontSize * scaleFor(currentIndex - 2)}
              color={colorFor(currentIndex - 2)}
              anchorX={anchorFor(currentIndex - 2)}
              anchorY="middle"
              textAlign={anchorFor(currentIndex - 2)}
              maxWidth={8}
              onSync={tuneMaterial}
              outlineWidth={0.002}
              outlineColor="#000"
            >
              {data[currentIndex - 2].text}
            </Text>
          )}
           {hasPrev && prev && (
            <Text
               position={[sideX(currentIndex - 1), worldStepLevels(1, currentIndex - 1) + extraY(currentIndex - 1), zShift(currentIndex - 1)]}
              fontSize={fontSize * scaleFor(currentIndex - 1)}
              color={colorFor(currentIndex - 1)}
              anchorX={anchorFor(currentIndex - 1)}
              anchorY="middle"
              textAlign={anchorFor(currentIndex - 1)}
              maxWidth={8}
              onSync={tuneMaterial}
              outlineWidth={0.002}
              outlineColor="#000"
            >
              {prev.text}
            </Text>
          )}
          {cur && (
            <Text
              position={[sideX(currentIndex), 0 + extraY(currentIndex), zShift(currentIndex)]}
              fontSize={fontSize * scaleFor(currentIndex)}
              color={'#ffe05a'}
              outlineWidth={0.05}
              outlineOpacity={0.1}
              outlineBlur={0.8}
              outlineColor={'#ffe05a'}
              anchorX={anchorFor(currentIndex)}
              anchorY="middle"
              textAlign={anchorFor(currentIndex)}
              maxWidth={8}
              onSync={(obj:any)=>{ try{ const m=obj?.material; if (!m) return; m.depthTest=true; m.depthWrite=true; m.transparent=true; if('toneMapped' in m) (m as any).toneMapped=false; m.needsUpdate=true; }catch{} }}
            >
              {cur.text}
            </Text>
          )}
           {next && (
            <Text
               position={[sideX(currentIndex + 1), -worldStepLevels(1, currentIndex + 1) + extraY(currentIndex + 1), zShift(currentIndex + 1)]}
              fontSize={fontSize * scaleFor(currentIndex + 1)}
              color={colorFor(currentIndex + 1)}
              anchorX={anchorFor(currentIndex + 1)}
              anchorY="middle"
              textAlign={anchorFor(currentIndex + 1)}
              maxWidth={8}
              onSync={tuneMaterial}
              outlineWidth={0.008}
              outlineColor="#000"
            >
              {next.text}
            </Text>
          )}
           {data[currentIndex + 2] && (
            <Text
               position={[sideX(currentIndex + 2), -worldStepLevels(2, currentIndex + 2) + extraY(currentIndex + 2), zShift(currentIndex + 2)]}
              fontSize={fontSize * scaleFor(currentIndex + 2)}
              color={colorFor(currentIndex + 2)}
              anchorX={anchorFor(currentIndex + 2)}
              anchorY="middle"
              textAlign={anchorFor(currentIndex + 2)}
              maxWidth={8}
              onSync={tuneMaterial}
              outlineWidth={0.008}
              outlineColor="#000"
            >
              {data[currentIndex + 2].text}
            </Text>
          )}
        </>
      )}

      {effectiveMode === 'scroll' && (
        <>
          {(() => {
            try {
              // 渲染 scroll 附近的窗口行
              const items: React.ReactNode[] = [];
              const scroll = scrollRef.current;
              // 若滚动值变化较大，则触发一次 React 层级更新，避免仅依赖 drei 的内部更新
              if (Math.abs(scroll - lastRenderedScrollRef.current) > 0.001) {
                lastRenderedScrollRef.current = scroll;
                setRenderNonce(n => (n + 1) & 0xffff);
              }
              const start = Math.max(0, Math.floor(scroll) - effectiveWindowLines);
              const end = Math.min(data.length - 1, Math.floor(scroll) + effectiveWindowLines);
               for (let i = start; i <= end; i++) {
                // 连续滚动的 Y 位置：随着 scroll 连续变化
                // 前后行使用不同的视觉速度缩放（近快远慢）
                const layer = ((i % 3) + 3) % 3; // 0=前, 1/2=后
                const speedScale = layer === 0 ? effectiveFrontScale : effectiveBackScale;
                 // 每层的“屏幕等距”世界步长（按距离/FOV换算），再叠加逻辑空行倍数
                 const lineHeight = worldStepLevels(1, i);
                 const y = (i - scroll * speedScale) * -lineHeight + extraY(i);
                // 颜色与描边：当前行附近更亮
                const dist = Math.abs(i - scroll);
                const isCenterish = dist < 0.5;
                const color = isCenterish ? '#ffe05a' : '#a8a8a8';
                const outlineW = isCenterish ? 0.06 : 0.008;
                const outlineO = isCenterish ? 0.28 : 0.18;
                items.push(
                  <Text
                    key={i}
                    position={[sideX(i), y, zShift(i)]}
                    fontSize={fontSize * scaleFor(i)}
                    color={color}
                    anchorX={anchorFor(i)}
                    anchorY="middle"
                    textAlign={anchorFor(i)}
                    maxWidth={8}
                    onSync={(obj:any)=>{ try{ const m=obj?.material; if (!m) return; m.depthTest=true; m.depthWrite=true; m.transparent=true; if('toneMapped' in m) (m as any).toneMapped=false; m.needsUpdate=true; }catch{} }}
                    outlineWidth={outlineW}
                    outlineOpacity={outlineO}
                    outlineBlur={isCenterish ? 0.6 : 0.2}
                    outlineColor={isCenterish ? '#ffe05a' : '#000'}
                  >
                    {data[i].text}
                  </Text>
                );
              }
              return items;
            } catch (err) {
              try { console.warn('[Lyrics3DOverlay] scroll render error', err); } catch {}
              return null;
            }
          })()}
        </>
      )}
    </group>
  );
}


