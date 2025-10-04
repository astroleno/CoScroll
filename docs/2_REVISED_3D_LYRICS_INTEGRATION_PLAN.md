# 修订版：3D 字幕集成开发计划

> 基于架构审查报告重新设计的实施方案，采用独立组件架构和MVP优先策略

## 项目概述

### 核心目标
- 将字幕从 2D UI 层迁移到 Three.js 3D 场景中
- 实现字幕与**锚字3D模型**的前后遮挡交互（前-后-后循环）
- **完全复刻现有2D字幕的布局和样式**，只增加空间深度
- **保持现有功能完全不变**（渐进式升级）
- 创造沉浸式的 3D 经卷体验

### 修订后的技术方案
- **架构设计**: 独立组件 + 组合模式
- **文字渲染**: Troika Text (SDF 技术)
- **空间布局**: 相对于锚字3D模型的"前-后-后"两层循环
- **状态管理**: Zustand store（复用现有）
- **渲染策略**: MVP优先，渐进式增强

## 修订后的架构设计

### 组件架构图
```
page.tsx
├── LyricsController (保持2D，可隐藏)
├── JadeV6
│   ├── JadeV6Content
│   │   ├── RotationController
│   │   │   ├── DualLayerModelLoader (现有)
│   │   │   └── Lyrics3DRenderer (新增独立组件)
│   │   └── 环境系统
│   └── Canvas配置
└── LyricsStore (新增Zustand状态管理)
```

### 数据流设计
```
LyricsController (现有逻辑)
    ↓ onActiveLineChange, onScrollVelocityChange
LyricsStore (新增，统一状态管理)
    ↓ 订阅状态 + 当前锚字模型引用
Lyrics3DRenderer (独立3D渲染)
    ↓ 相对于锚字模型的"前-后-后"布局计算
Scene (锚字模型与字幕的遮挡交互)
```

### "前-后-后"空间布局详解

#### 📐 **相对于锚字3D模型的两层关系**
```
用户眼睛 👀
    ↓
前层 (z = -0.5)  ← 第1、4、7...行字幕（在锚字模型前面，完全可见）
    ↓
锚字3D模型 (z = 0)  ← 当前显示的"观"、"空"、"心"等3D文字模型
    ↓
后层 (z = +0.8)  ← 第2、3、5、6...行字幕（在锚字模型后面，被遮挡）
```

#### 🔄 **循环模式说明**
- **第1行** → 前（在"观"字前面，不会被遮挡）
- **第2行** → 后（在"观"字后面，会被遮挡）
- **第3行** → 后（在"观"字后面，会被遮挡）
- **第4行** → 前（在"观"字前面，不会被遮挡）
- **第5行** → 后（在"观"字后面，会被遮挡）
- **第6行** → 后（在"观"字后面，会被遮挡）
- ...依此类推

#### 🎯 **与锚字模型的动态交互**
- 当锚字从"观"切换到"空"时，字幕的前后关系重新分配
- 前层字幕会**穿过锚字模型的透明部分**
- 后层字幕会被**锚字模型的不透明部分遮挡**
- 创造出真实的3D空间层次感和遮挡关系

## 开发任务清单

### 阶段一：基础架构搭建（1周）

#### 1.1 状态管理系统
- [ ] 创建 `src/stores/lyrics3DStore.ts`
- [ ] 定义 Lyrics3D 状态接口
- [ ] 实现状态同步逻辑
- [ ] 添加性能监控钩子

```typescript
// src/stores/lyrics3DStore.ts
interface Lyrics3DState {
  // 基础状态
  lyricsData: LyricLine[];
  currentIndex: number;
  scrollTime: number;
  isPlaying: boolean;

  // 计算属性
  visibleLyrics: LyricLine[];
  currentLyric: LyricLine | null;
  scrollVelocity: number;

  // 3D特定状态
  qualityLevel: 'high' | 'medium' | 'low';
  mobileMode: boolean;

  // 锚字模型相关状态
  currentAnchorModel: THREE.Object3D | null;
  anchorModelPosition: THREE.Vector3;
  anchorModelSize: THREE.Vector3;

  // 操作方法
  updateFromLyricsController: (data: LyricsControllerData) => void;
  setQualityLevel: (level: QualityLevel) => void;
  syncWithAudio: (currentTime: number) => void;
  updateAnchorModel: (model: THREE.Object3D, anchor: string) => void;
}
```

#### 1.2 类型系统定义
- [ ] 扩展 `src/types/lyrics.types.ts`
- [ ] 添加 3D 渲染相关类型
- [ ] 定义质量配置接口

```typescript
// src/types/lyrics.types.ts 扩展
export interface Lyrics3DConfig {
  maxVisibleLyrics: number;
  updateRate: number;
  enableOcclusion: boolean; // 改为遮挡效果
  qualityLevel: QualityLevel;
  anchorModelReference?: THREE.Object3D;
}

export interface Lyrics3DProps {
  lyricsData: LyricLine[];
  currentIndex: number;
  scrollTime: number;
  isPlaying: boolean;
  scrollVelocity: number;
  config?: Lyrics3DConfig;
  // 锚字模型相关
  anchorModel?: THREE.Object3D;
  anchorModelSize?: THREE.Vector3;
  currentAnchor?: string;
}
```

#### 1.3 Lyrics3DRenderer 组件框架
- [ ] 创建 `src/components/lyrics/Lyrics3DRenderer.tsx`
- [ ] 实现基础组件结构
- [ ] 添加 Zustand store 订阅
- [ ] 集成到 JadeV6Content

```typescript
// src/components/lyrics/Lyrics3DRenderer.tsx
export default function Lyrics3DRenderer(props: Lyrics3DProps) {
  const lyricsStore = useLyrics3DStore();

  // 监听锚字模型变化
  useEffect(() => {
    if (props.anchorModel) {
      lyricsStore.updateAnchorModel(props.anchorModel, props.currentAnchor || '心');
    }
  }, [props.anchorModel, props.currentAnchor]);

  // 基础渲染逻辑
  // Troika Text 集成
  // 相对于锚字模型的位置计算（前-后-后）
  // 性能优化

  return (
    <group>
      {/* 3D文字渲染，位置相对于锚字模型计算 */}
    </group>
  );
}
```

### 阶段二：MVP核心功能（1周）

#### 2.1 Troika Text 集成
- [ ] 安装和配置 Troika Three Text
- [ ] 实现基础文字渲染
- [ ] 添加中文字体支持
- [ ] 字体加载失败回退机制

```bash
npm install three-stdlib troika-three-text
```

#### 2.2 基础3D文字显示
- [ ] 实现左右分布算法
- [ ] 基础位置计算逻辑
- [ ] 简单的透明度控制
- [ ] 当前行高亮显示

```typescript
// 基础位置计算（相对于锚字模型的"前-后-后"布局）
const calculateTextPosition = (index: number, currentIndex: number, anchorModelPosition: THREE.Vector3) => {
  const isLeft = index % 2 === 0;
  const x = isLeft ? -3 : 3;  // 左右分布，复刻现有2D布局
  const y = (index - currentIndex) * 1.2; // 上下位置，对应滚动效果

  // "前-后-后"循环：相对于锚字模型的前后关系
  const relativeIndex = Math.abs(index - currentIndex);
  const layerCycle = relativeIndex % 3;

  const depthOffset = {
    0: -0.5,  // 前：在锚字模型前面（不会被遮挡）
    1: +0.8,  // 后：在锚字模型后面（会被遮挡）
    2: +0.8   // 后：在锚字模型后面（会被遮挡）
  }[layerCycle];

  const z = anchorModelPosition.z + depthOffset;

  return [x, y, z];
};
```

#### 2.3 基础同步逻辑
- [ ] 实现与 LyricsController 的状态同步
- [ ] 基础的时间同步
- [ ] 滚动速度响应
- [ ] 播放状态同步

#### 2.4 集成测试
- [ ] 基础功能验证
- [ ] 状态同步测试
- [ ] 性能基准测试
- [ ] 移动端兼容性检查

### 阶段三：视觉效果优化（1周）

#### 3.1 锚字模型遮挡效果实现
- [ ] 实现字幕相对于锚字3D模型的精确前后定位
- [ ] 调整字幕的深度渲染顺序（renderOrder）
- [ ] 确保前层字幕正确遮挡后层字幕
- [ ] 优化锚字模型与字幕的视觉层次关系
- [ ] 调试"前-后-后"循环的视觉效果

#### 3.2 动画效果增强
- [ ] 平滑的位置过渡动画
- [ ] 透明度渐变效果
- [ ] 当前行强调动画
- [ ] 滚动惯性模拟

```typescript
// 平滑动画实现
const useSmoothAnimation = (targetPosition: [number, number, number], targetOpacity: number) => {
  const [position, setPosition] = useState(targetPosition);
  const [opacity, setOpacity] = useState(targetOpacity);

  useFrame((_, delta) => {
    // 平滑插值到目标值
    setPosition(prev => prev.map((v, i) => THREE.MathUtils.lerp(v, targetPosition[i], delta * 3)));
    setOpacity(prev => THREE.MathUtils.lerp(prev, targetOpacity, delta * 3));
  });

  return { position, opacity };
};
```

#### 3.3 材质优化
- [ ] 文字材质与锚字3D模型协调
- [ ] 光照效果调整
- [ ] 环境反射优化
- [ ] 色彩平衡调整

### 阶段四：性能优化与完善（0.5周）

#### 4.1 渐进式性能优化
- [ ] 实现视锥剔除
- [ ] 动态LOD系统
- [ ] 渲染距离限制
- [ ] 实例化渲染优化

```typescript
// 性能优化配置
const PERFORMANCE_CONFIG = {
  desktop: {
    maxVisibleLyrics: 15,
    updateRate: 60,
    enableRefraction: true,
    qualityLevel: 'high' as const
  },
  mobile: {
    maxVisibleLyrics: 8,
    updateRate: 30,
    enableRefraction: false,
    qualityLevel: 'low' as const
  }
};
```

#### 4.2 2D字幕隐形模式
- [ ] 在 LyricsController 中添加隐形开关
- [ ] 保持所有现有逻辑不变
- [ ] 确保事件处理正常
- [ ] 添加调试模式切换

#### 4.3 最终测试与优化
- [ ] 全面功能测试
- [ ] 性能压力测试
- [ ] 用户体验测试
- [ ] 兼容性验证

## 风险评估与缓解策略

### 主要技术风险

#### 1. Troika Text 兼容性风险
**风险**: 中文字体渲染问题、加载失败
**缓解策略**:
```typescript
// 字体加载回退机制
const useRobustFontLoader = () => {
  const [font, setFont] = useState<THREE.Font | null>(null);
  const [fontStatus, setFontStatus] = useState<'loading' | 'loaded' | 'fallback'>('loading');

  useEffect(() => {
    // 尝试加载优化字体
    loadOptimizedFont()
      .then(setFont)
      .catch(() => {
        // 回退到基础字体
        return loadFallbackFont();
      })
      .then(setFont)
      .catch(() => {
        // 最后回退：使用系统字体
        setFontStatus('fallback');
      });
  }, []);

  return { font, fontStatus };
};
```

#### 2. 移动端性能风险
**风险**: 移动设备GPU性能不足
**缓解策略**:
```typescript
// 自适应质量系统
const useAdaptiveQuality = () => {
  const [quality, setQuality] = useState<QualityLevel>('high');

  useEffect(() => {
    // 检测设备性能
    const detectDevicePerformance = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const memory = (navigator as any).deviceMemory || 4;

      if (isMobile || memory < 4) {
        setQuality('low');
      } else if (memory < 8) {
        setQuality('medium');
      }
    };

    detectDevicePerformance();
  }, []);

  return quality;
};
```

#### 3. 状态同步精度风险
**风险**: 3D渲染与音频同步误差
**缓解策略**:
```typescript
// 高精度同步管理
const useSyncManager = () => {
  const [syncError, setSyncError] = useState(0);
  const lastSyncTime = useRef(Date.now());

  const syncCorrection = useCallback((audioTime: number, renderTime: number) => {
    const error = Math.abs(audioTime - renderTime);
    const now = Date.now();
    const deltaTime = now - lastSyncTime.current;

    if (error > SYNC_THRESHOLD && deltaTime > 100) { // 限制校正频率
      setSyncError(error);
      lastSyncTime.current = now;
      return error > 0.5; // 需要强制校正
    }
    return false;
  }, []);

  return { syncError, syncCorrection };
};
```

## 兼容性保证策略

### 现有功能保护
```typescript
// LyricsController 增强接口
interface LyricsControllerProps {
  // 保持所有现有props不变...
  lyrics: LyricLine[];
  currentTime: number;
  // ...其他现有props

  // 新增：3D模式开关
  enable3DMode?: boolean;
  on3DModeData?: (data: Lyrics3DData) => void;
}

// 在 LyricsController 内部
const LyricsController: React.FC<LyricsControllerProps> = ({
  enable3DMode = false,
  on3DModeData,
  ...props
}) => {
  // 现有逻辑完全保持不变

  // 新增：向3D组件提供数据
  useEffect(() => {
    if (enable3DMode && on3DModeData) {
      on3DModeData({
        lyricsData: lyrics,
        currentIndex: currentLineIndex,
        scrollTime,
        isPlaying,
        scrollVelocity
      });
    }
  }, [enable3DMode, currentLineIndex, scrollTime, isPlaying]);

  // 隐藏2D字幕但保持功能
  return (
    <div style={{ opacity: enable3DMode ? 0 : 1 }}>
      {/* 现有渲染逻辑完全不变 */}
    </div>
  );
};
```

### 渐进式功能切换
```typescript
// 在 page.tsx 中实现渐进式切换
const [lyrics3DEnabled, setLyrics3DEnabled] = useState(false);

// 添加调试开关（开发环境）
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    window.enableLyrics3D = () => setLyrics3DEnabled(true);
    window.disableLyrics3D = () => setLyrics3DEnabled(false);
  }
}, []);
```

## 性能目标与监控

### 性能指标
- **渲染帧率**: 桌面端 ≥55fps，移动端 ≥30fps
- **内存使用**: 增量不超过100MB
- **启动时间**: 不增加超过1秒
- **同步精度**: 音频与3D渲染误差 <200ms

### 性能监控实现
```typescript
// 性能监控Hook
const usePerformanceMonitor = () => {
  const frameCount = useRef(0);
  const lastTime = useRef(Date.now());

  useFrame(() => {
    frameCount.current++;
    const now = Date.now();
    const delta = now - lastTime.current;

    if (delta >= 1000) {
      const fps = (frameCount.current * 1000) / delta;
      frameCount.current = 0;
      lastTime.current = now;

      // 性能警告
      if (fps < 30) {
        console.warn(`[Lyrics3D] Low FPS detected: ${fps.toFixed(1)}`);
        // 自动降级
        adjustQualityLevel('low');
      }
    }
  });
};
```

## 验收标准

### 功能验收 ✅
- [ ] 3D字幕与锚字3D模型的"前-后-后"遮挡关系正确
- [ ] 字幕与锚字模型的遮挡效果清晰可见且符合预期
- [ ] 与现有音频播放完全同步
- [ ] 滚动交互响应灵敏
- [ ] 现有2D字幕功能完全保留

### 性能验收 ✅
- [ ] 桌面端渲染帧率保持55fps以上
- [ ] 移动端渲染帧率保持30fps以上
- [ ] 内存使用增量控制在100MB以内
- [ ] 启动时间增加不超过1秒

### 用户体验验收 ✅
- [ ] 视觉效果显著优于2D版本
- [ ] 交互体验流畅无卡顿
- [ ] 移动端使用体验良好
- [ ] 无明显的视觉或交互问题

## 开发里程碑

| 里程碑 | 时间 | 主要交付物 | 验收标准 |
|--------|------|------------|----------|
| M1: 基础架构 | 第1周末 | 状态管理、类型系统、组件框架 | 代码结构清晰，类型安全 |
| M2: MVP功能 | 第2周末 | 基础3D字幕渲染、状态同步 | 3D字幕正确显示和同步 |
| M3: 视觉优化 | 第3周末 | 遮挡效果、动画增强 | 视觉效果符合设计预期 |
| M4: 最终版本 | 第3.5周末 | 性能优化、完整测试 | 所有验收标准达标 |

## 后续扩展计划

### 短期扩展（版本1.1）
- [ ] 更多文字特效（粒子化、发光等）
- [ ] 自定义字体支持
- [ ] 主题色彩切换
- [ ] 音效同步增强

### 长期扩展（版本2.0）
- [ ] 多语言字幕支持
- [ ] AI驱动的动态字幕效果
- [ ] 手势控制集成
- [ ] VR/AR支持

---

**开发团队**: CoScroll 项目组
**预计工期**: 3.5 周
**优先级**: 高
**状态**: 待开始
**最后更新**: 2025-10-04