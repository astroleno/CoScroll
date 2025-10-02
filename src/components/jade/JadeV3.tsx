"use client";

import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo } from "react";

// 复用已有的 JadeV2 渲染核心（材质、加载、PMREM 等逻辑都在内部）
const JadeV2 = dynamic(() => import("@/components/jade/JadeV2"), { ssr: false });

export interface JadeV3Props {
  // 是否显示 HDRI 作为可见背景（true 时画面可见天空；false 时背景透明）
  showBackground?: boolean;
  // 是否开启自动旋转
  enableRotation?: boolean;
  // 全局曝光（影响 HDRI 亮度与整体调性）
  hdrExposure?: number;
  // 可选：自定义 HDRI 路径
  hdrPath?: string;
  // 可选：模型路径
  modelPath?: string;
}

export default function JadeV3({
  showBackground = true,
  enableRotation = true,
  hdrExposure = 1.0,
  hdrPath = "/textures/qwantani_moon_noon_puresky_1k.hdr",
  modelPath = "/models/10k_obj/001_空.obj",
}: JadeV3Props) {
  // 固定一组默认材质参数（与 jade-v2 页面一致），支持后续按需外部扩展
  const materialOptions = useMemo(
    () => ({
      color: 0xffffff,
      metalness: 0.0,
      roughness: 0.81,
      transmission: 1.0,
      ior: 1.5,
      reflectivity: 0.38,
      thickness: 1.1,
      envMapIntensity: 1.4,
      clearcoat: 0.0,
      clearcoatRoughness: 1.0,
      normalScale: 0.3,
      clearcoatNormalScale: 0.2,
      normalRepeat: 3,
    }),
    []
  );

  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ toneMappingExposure: hdrExposure }}
      style={{ width: "100%", height: "100%" }}
    >
      <Suspense fallback={null}>
        <JadeV2
          modelPath={modelPath}
          hdrPath={hdrPath}
          normalMapPath="/textures/normal.jpg"
          showBackground={showBackground}
          useDualPassRefraction={false}
          color={materialOptions.color}
          metalness={materialOptions.metalness}
          roughness={materialOptions.roughness}
          transmission={materialOptions.transmission}
          ior={materialOptions.ior}
          reflectivity={materialOptions.reflectivity}
          thickness={materialOptions.thickness}
          envMapIntensity={materialOptions.envMapIntensity}
          clearcoat={materialOptions.clearcoat}
          clearcoatRoughness={materialOptions.clearcoatRoughness}
          normalScale={materialOptions.normalScale}
          clearcoatNormalScale={materialOptions.clearcoatNormalScale}
          normalRepeat={materialOptions.normalRepeat}
          autoRotate={enableRotation}
        />
      </Suspense>
    </Canvas>
  );
}


