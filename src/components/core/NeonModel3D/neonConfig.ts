/**
 * 弥散霓虹渲染组件配置管理
 * 基于参考图风格特点的参数配置
 */

export interface NeonConfig {
  // 着色器参数
  fresnelIntensity: number      // Fresnel边缘发光强度
  innerGlowIntensity: number   // 内部发光强度
  gradientStrength: number     // 渐变强度
  grainIntensity: number       // 颗粒强度
  
  // 色彩参数
  mainColor: string           // 主色调 (粉橙)
  secondaryColor: string      // 次色调 (青蓝)
  rimColor: string           // 边缘色 (金色)
  
  // 后期处理参数
  bloomIntensity: number      // Bloom强度
  bloomThreshold: number      // Bloom阈值
  grainOpacity: number        // 颗粒不透明度
  
  // 光照参数
  ambientIntensity: number    // 环境光强度
  mainLightIntensity: number  // 主光源强度
  breathingSpeed: number      // 呼吸动画速度
  
  // 动画参数
  autoRotate: boolean         // 自动旋转
  rotationSpeed: number       // 旋转速度
  wobbleIntensity: number     // 浮动强度
}

// 默认配置 - 基于参考图优化
export const defaultNeonConfig: NeonConfig = {
  // 着色器参数
  fresnelIntensity: 1.5,      // 中等Fresnel强度
  innerGlowIntensity: 1.0,    // 适中内部发光
  gradientStrength: 0.45,     // 渐变强度
  grainIntensity: 0.55,       // 颗粒强度
  
  // 色彩参数 - 参考图精确色彩
  mainColor: '#ff6b9d',       // 粉橙色
  secondaryColor: '#4ecdc4',  // 青蓝色
  rimColor: '#ffd18b',        // 金色边缘
  
  // 后期处理参数
  bloomIntensity: 0.9,        // 控制Bloom效果
  bloomThreshold: 0.22,       // 稍高阈值保留细节
  grainOpacity: 0.45,         // 颗粒不透明度
  
  // 光照参数
  ambientIntensity: 0.5,      // 环境光
  mainLightIntensity: 1.1,    // 主光源
  breathingSpeed: 0.7,        // 呼吸频率
  
  // 动画参数
  autoRotate: true,           // 默认自动旋转
  rotationSpeed: 0.4,         // 慢速旋转
  wobbleIntensity: 0.25       // 轻微浮动
}

// 预设配置
export const neonPresets = {
  // 默认预设 - 参考图风格
  default: defaultNeonConfig,
  
  // 柔和预设 - 适合移动端
  soft: {
    ...defaultNeonConfig,
    fresnelIntensity: 1.8,
    innerGlowIntensity: 1.2,
    bloomIntensity: 1.5,
    grainIntensity: 0.3
  },
  
  // 强烈预设 - 桌面端高质量
  intense: {
    ...defaultNeonConfig,
    fresnelIntensity: 3.0,
    innerGlowIntensity: 2.2,
    bloomIntensity: 2.5,
    grainIntensity: 0.6
  },
  
  // 性能预设 - 低端设备
  performance: {
    ...defaultNeonConfig,
    fresnelIntensity: 1.5,
    innerGlowIntensity: 1.0,
    bloomIntensity: 1.0,
    grainIntensity: 0.2,
    autoRotate: false
  }
}

// 配置验证函数
export function validateNeonConfig(config: Partial<NeonConfig>): NeonConfig {
  return {
    ...defaultNeonConfig,
    ...config,
    // 确保数值在合理范围内
    fresnelIntensity: Math.max(0, Math.min(5, config.fresnelIntensity ?? defaultNeonConfig.fresnelIntensity)),
    innerGlowIntensity: Math.max(0, Math.min(3, config.innerGlowIntensity ?? defaultNeonConfig.innerGlowIntensity)),
    gradientStrength: Math.max(0, Math.min(1, config.gradientStrength ?? defaultNeonConfig.gradientStrength)),
    grainIntensity: Math.max(0, Math.min(1, config.grainIntensity ?? defaultNeonConfig.grainIntensity)),
    bloomIntensity: Math.max(0, Math.min(5, config.bloomIntensity ?? defaultNeonConfig.bloomIntensity)),
    bloomThreshold: Math.max(0, Math.min(1, config.bloomThreshold ?? defaultNeonConfig.bloomThreshold)),
    grainOpacity: Math.max(0, Math.min(1, config.grainOpacity ?? defaultNeonConfig.grainOpacity)),
    ambientIntensity: Math.max(0, Math.min(2, config.ambientIntensity ?? defaultNeonConfig.ambientIntensity)),
    mainLightIntensity: Math.max(0, Math.min(3, config.mainLightIntensity ?? defaultNeonConfig.mainLightIntensity)),
    breathingSpeed: Math.max(0.1, Math.min(2, config.breathingSpeed ?? defaultNeonConfig.breathingSpeed)),
    rotationSpeed: Math.max(0, Math.min(2, config.rotationSpeed ?? defaultNeonConfig.rotationSpeed)),
    wobbleIntensity: Math.max(0, Math.min(1, config.wobbleIntensity ?? defaultNeonConfig.wobbleIntensity))
  }
}
