'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import MochiCore from './core/MochiCore';
import FresnelShell from './core/FresnelShell';
import VolumeShells from './core/VolumeShells';
import GradientBackground from './backgrounds/GradientBackground';
import MochiComposer from './effects/MochiComposer';
import { MochiSphereProps } from './types';
import { defaultMochiConfig, mochiThemes } from './presets';

export default function MochiSphere(props: Partial<MochiSphereProps> = {}) {
  // 合并默认配置和用户配置
  const config = { ...defaultMochiConfig, ...props };

  // 应用主题预设
  const theme = config.theme ? mochiThemes[config.theme] : null;
  const baseColor = theme?.baseColor || config.baseColor || defaultMochiConfig.baseColor || '#ffd4e5';
  const attenuationColor = theme?.attenuationColor || config.attenuationColor || '#b8d4ff';
  const glowColor = theme?.glowColor || config.glowColor || '#ffb3d9';
  const background = theme?.background || ['#e8d4f2', '#d4e8ff'];

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* 背景渐变 */}
        <GradientBackground colors={background as [string, string]} />

        {/* 环境光 */}
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.5} />

        {/* 核心球体 */}
        <MochiCore
          radius={config.radius!}
          segments={config.segments!}
          roughness={config.roughness!}
          transmission={config.transmission!}
          thickness={config.thickness!}
          baseColor={baseColor}
          attenuationColor={attenuationColor}
          autoRotate={config.autoRotate!}
          rotationSpeed={config.rotationSpeed!}
          enableTransmission={config.enableTransmission!}
        />

        {/* Fresnel 发光壳 */}
        <FresnelShell
          radius={config.radius!}
          segments={config.segments!}
          glowColor={glowColor}
          fresnelPower={config.fresnelPower!}
          rimRange={config.rimRange!}
          glowIntensity={config.glowIntensity!}
        />

        {/* 体积外壳 */}
        <VolumeShells
          radius={config.radius!}
          segments={config.segments!}
          shellOffsets={config.shellOffsets!}
          glowColor={glowColor}
        />

        {/* 后期效果 */}
        <MochiComposer
          bloomStrength={config.bloomStrength!}
          bloomRadius={config.bloomRadius!}
          bloomThreshold={config.bloomThreshold!}
        />

        {/* 轨道控制（测试用） */}
        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
}
