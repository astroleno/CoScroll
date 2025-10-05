"use client";

import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Text, Environment, OrbitControls } from '@react-three/drei';
import JadeModelLoader from '@/components/jade/JadeModelLoader';

function BottomLayer() {
  return (
    <>
      <Text
        position={[0, -0.15, -1.2]}
        fontSize={0.42}
        color="#66ccff"
        anchorX="center"
        anchorY="middle"
        material-toneMapped={false}
      >
        背景层文字（会被上层挡住）
      </Text>
      <Text
        position={[0, -0.55, -1.2]}
        fontSize={0.35}
        color="#ffcc66"
        anchorX="center"
        anchorY="middle"
        material-toneMapped={false}
      >
        第二行背景文字
      </Text>
    </>
  );
}

function MiddleLayer() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 2, 2]} intensity={1.2} />
      <Environment preset="sunset" background={false} />
      <group>
        <JadeModelLoader
          modelPath="/models/10k_obj/001_空.obj"
          fitToView
          enableRotation
          rotationDurationSec={10}
          enableScrollControl={false}
          baseSpeed={0.4}
          speedMultiplier={2.0}
          innerColor="#2d6d8b"
          innerMetalness={1.0}
          innerRoughness={1.0}
          innerTransmission={0.0}
          enableEmissive
          innerEmissiveColor="#0f2b38"
          innerEmissiveIntensity={1.2}
          innerEnvMapIntensity={0.8}
          outerColor="#6be3ff"
          outerMetalness={0.0}
          outerRoughness={0.08}
          outerTransmission={1.0}
          outerIor={1.5}
          outerReflectivity={0.1}
          outerThickness={0.35}
          outerClearcoat={1.0}
          outerClearcoatRoughness={0.08}
          outerEnvMapIntensity={1.0}
          creaseAngle={30}
          smoothShading
          innerSmoothShading
          outerSmoothShading
        />
      </group>
      <OrbitControls />
    </>
  );
}

function TopLayer() {
  return (
    <>
      <Text
        position={[0, -0.55, -1.0]}
        fontSize={0.28}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        material-toneMapped={false}
      >
        顶层文字（遮住模型）
      </Text>
      <Text
        position={[0, -0.75, -1.0]}
        fontSize={0.24}
        color="#ff6666"
        anchorX="center"
        anchorY="middle"
        material-toneMapped={false}
      >
        第二行顶层文字
      </Text>
    </>
  );
}

export default function LayerTestPage() {
  const [midOpacity, setMidOpacity] = useState(0.95);
  const [showDebug, setShowDebug] = useState(true);

  return (
    <div className="min-h-screen text-white" style={{ background: '#1f1e1c' }}>
      <div className="fixed left-4 top-4 z-50 bg-black/80 p-4 rounded-lg space-y-4">
        <h2 className="text-lg font-semibold">三层 Canvas 叠加测试</h2>
        <div>
          <label className="block text-sm mb-2">
            中层（模型）透明度: {midOpacity.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={midOpacity}
            onChange={(e) => setMidOpacity(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showDebug}
            onChange={(e) => setShowDebug(e.target.checked)}
          />
          显示调试信息
        </label>
        {showDebug && (
          <div className="text-xs space-y-1 opacity-80">
            <div>• 底层：背景文字（蓝色）</div>
            <div>• 中层： Jade 模型（可调节透明度）</div>
            <div>• 顶层：前景文字（白色/红色）</div>
            <div className="mt-1 text-yellow-400">
              提示：这是 2D 叠加遮挡，没有跨层 3D 深度/折射
            </div>
          </div>
        )}
      </div>

      <div className="relative w-full h-screen grid grid-cols-1 grid-rows-1">
        <div className="col-start-1 row-start-1">
          <Canvas
            camera={{ position: [0, 0, 3], fov: 50 }}
            gl={{ alpha: true }}
            style={{ background: '#1f1e1c' }}
          >
            <Suspense fallback={null}>
              <BottomLayer />
            </Suspense>
          </Canvas>
        </div>

      <div className="col-start-1 row-start-1" style={{ opacity: midOpacity }}>
        <Canvas camera={{ position: [0, 0, 3], fov: 50 }} gl={{ alpha: true }}>
          <Suspense fallback={null}>
            <MiddleLayer />
          </Suspense>
        </Canvas>
      </div>

      <div className="col-start-1 row-start-1 pointer-events-none" aria-hidden>
        <div
          className="w-full h-full"
          style={{
            background: 'radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.08), rgba(31, 30, 28, 0) 60%)',
          }}
        />
      </div>

      <div className="col-start-1 row-start-1 pointer-events-none">
        <Canvas camera={{ position: [0, 0, 3], fov: 50 }} gl={{ alpha: true }}>
          <Suspense fallback={null}>
            <TopLayer />
          </Suspense>
        </Canvas>
        </div>
      </div>
    </div>
  );
}
