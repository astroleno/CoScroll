"use client";

import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { createScreenSpaceRefractionMaterial } from "./ScreenSpaceRefractionMaterial";

export interface JadeV4Props {
  // 背景是否可见（仅影响 scene.background）
  showBackground?: boolean;
  // 是否自动旋转模型
  enableRotation?: boolean;
  // 全局曝光（影响渲染器 toneMappingExposure）
  hdrExposure?: number;
  // 纯色背景（优先级高于 backgroundHdrPath）。若提供，将使用纯色作为 scene.background
  backgroundColor?: string | number;
  // 背景 HDR 路径（仅用于 scene.background，可与折射 env 不同源）
  backgroundHdrPath?: string;
  // 折射/IBL 环境 HDR 路径（将进行 PMREM，用于 scene.environment 和材质 envMap）
  refractionEnvPath?: string;
  // 模型路径（支持 OBJ/GLB/GLTF）
  modelPath?: string;
  // 法线贴图（可选）
  normalMapPath?: string;

  // 材质参数（与 V2/V3 风格一致，保持易用）
  color?: string | number;
  metalness?: number;
  roughness?: number;
  transmission?: number;
  ior?: number;
  reflectivity?: number;
  thickness?: number;
  envMapIntensity?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  normalScale?: number;

  // 调试：强制走反射路径验证 env（忽略 transmission）
  debugForceReflection?: boolean;
  // 是否启用双通道屏幕后折射（推荐用于背景解耦）
  useDualPassRefraction?: boolean;
  // 折射外观控制（SSR 模式下生效）
  refractionGain?: number;
  refractionTint?: string | number;
  refractionTintStrength?: number;
  refractionOffsetBoost?: number;
  refractionBaseMix?: number;
  refractionGamma?: number;
}

function JadeV4Content({
  showBackground = true,
  enableRotation = true,
  backgroundColor,
  backgroundHdrPath = "/textures/qwantani_moon_noon_puresky_1k.hdr",
  refractionEnvPath = "/textures/qwantani_moon_noon_puresky_1k.hdr",
  modelPath = "/models/10k_obj/001_空.obj",
  normalMapPath = "/textures/normal.jpg",
  debugForceReflection = false,
  useDualPassRefraction = true,
  refractionGain = 1.8,
  refractionTint,
  refractionTintStrength = 0.0,
  refractionOffsetBoost = 4.0,
  refractionBaseMix = 0.35,
  refractionGamma = 1.0,
  color = 0xffffff,
  metalness = 0.0,
  roughness = 0.55,
  transmission = 1.0,
  ior = 1.5,
  reflectivity = 0.38,
  thickness = 1.1,
  envMapIntensity = 1.4,
  clearcoat = 0.0,
  clearcoatRoughness = 1.0,
  normalScale = 0.3,
}: JadeV4Props) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { gl, scene, camera, size } = useThree();

  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [envMap, setEnvMap] = useState<THREE.Texture | null>(null);
  const [bgTexture, setBgTexture] = useState<THREE.Texture | null>(null);
  const [normalMap, setNormalMap] = useState<THREE.Texture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 双通道：离屏 RT 与材质
  const rtRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const [refractionMap, setRefractionMap] = useState<THREE.Texture | null>(null);
  const [ssrMat, setSsrMat] = useState<THREE.ShaderMaterial | null>(null);

  // 加载模型（支持 OBJ/GLTF）
  useEffect(() => {
    let disposed = false;
    const lower = (modelPath || "").toLowerCase();
    const isOBJ = lower.endsWith(".obj");
    if (isOBJ) {
      const loader = new OBJLoader();
      try {
        loader.load(
          modelPath!,
          (obj) => {
            if (disposed) return;
            try {
              let found: THREE.BufferGeometry | null = null;
              obj.traverse((child) => {
                if (!found && (child as THREE.Mesh).isMesh) {
                  found = (child as THREE.Mesh).geometry as THREE.BufferGeometry;
                }
              });
              if (!found) {
                setError("未在 OBJ 中找到网格");
                return;
              }
              const cloned = found.clone();
              try { cloned.center(); } catch {}
              try { cloned.computeVertexNormals(); } catch {}
              setGeometry(cloned);
            } catch (e) {
              console.error("[JadeV4] 解析 OBJ 失败:", e);
              setError("解析 OBJ 失败");
            }
          },
          undefined,
          (err) => {
            console.error("[JadeV4] 加载 OBJ 出错:", err);
            try { setGeometry(new THREE.SphereGeometry(0.8, 48, 48)); } catch {}
            setError("加载模型失败");
          }
        );
      } catch (e) {
        console.error("[JadeV4] OBJLoader 异常:", e);
        setError("OBJLoader 异常");
      }
    } else {
      const loader = new GLTFLoader();
      try {
        loader.load(
          modelPath!,
          (gltf) => {
            if (disposed) return;
            try {
              let target: THREE.Mesh | undefined;
              gltf.scene.traverse((obj) => {
                if (!target && (obj as THREE.Mesh).isMesh) target = obj as THREE.Mesh;
              });
              if (!target) {
                setError("未在 GLTF 中找到可用网格");
                return;
              }
              const cloned = (target.geometry as THREE.BufferGeometry).clone();
              try { cloned.center(); } catch {}
              try { cloned.computeVertexNormals(); } catch {}
              setGeometry(cloned);
            } catch (e) {
              console.error("[JadeV4] 解析 GLTF 失败:", e);
              setError("解析 GLTF 失败");
            }
          },
          undefined,
          (err) => {
            console.error("[JadeV4] 加载 GLTF 出错:", err);
            try { setGeometry(new THREE.SphereGeometry(0.8, 48, 48)); } catch {}
            setError("加载模型失败");
          }
        );
      } catch (e) {
        console.error("[JadeV4] GLTFLoader 异常:", e);
        setError("GLTFLoader 异常");
      }
    }
    return () => { disposed = true; };
  }, [modelPath]);

  // 加载折射/IBL 环境（PMREM），仅用于 scene.environment 和材质 envMap
  useEffect(() => {
    let disposed = false;
    const rgbe = new RGBELoader();
    try {
      rgbe.load(
        refractionEnvPath!,
        (texture) => {
          if (disposed) return;
          try {
            const pmrem = new THREE.PMREMGenerator(gl);
            pmrem.compileEquirectangularShader();
            const envRT = pmrem.fromEquirectangular(texture);
            const envTex = envRT.texture;
            setEnvMap(envTex);
            try {
              scene.environment = envTex;
            } catch {}
            pmrem.dispose();
            console.log("[JadeV4] ✅ Refraction env PMREM 成功", { path: refractionEnvPath, w: (envTex as any).image?.width, h: (envTex as any).image?.height });
          } catch (e) {
            console.error("[JadeV4] 折射环境 PMREM 失败:", e);
            setError("折射环境 PMREM 失败");
          }
        },
        undefined,
        (err) => {
          console.error("[JadeV4] 加载折射 env HDR 失败:", err);
          setError("加载折射 env HDR 失败");
        }
      );
    } catch (e) {
      console.error("[JadeV4] RGBELoader 异常(refraction):", e);
      setError("RGBELoader 异常(refraction)");
    }
    return () => { disposed = true; };
  }, [refractionEnvPath, gl, scene]);

  // 设置背景加载策略：
  // - 若提供 backgroundColor：不直接设置 scene.background，但仍然加载 backgroundHdrPath 为 equirect 纹理，
  //   以便在渲染调用时“瞬时切换”为背景供 transmission 取样，随后立刻还原为 null（视觉仍是 CSS 纯色）。
  // - 若未提供 backgroundColor 且 showBackground=true：正常把 HDR 设为 scene.background（可见背景）。
  useEffect(() => {
    let disposed = false;
    if (!showBackground) {
      try { if (scene.background) scene.background = null; } catch {}
      setBgTexture(null);
      return;
    }
    // 若有纯色需求：仍然加载 HDR，但不直接设为 scene.background
    const rgbe = new RGBELoader();
    try {
      rgbe.load(
        backgroundHdrPath!,
        (texture) => {
          if (disposed) return;
          try {
            // 注意：与 envMap 使用不同的纹理实例，避免互相影响
            texture.mapping = THREE.EquirectangularReflectionMapping;
            setBgTexture(texture);
            if (backgroundColor === undefined || backgroundColor === null) {
              try { scene.background = texture; } catch {}
              console.log("[JadeV4] ✅ 背景 HDR 加载并可见", { path: backgroundHdrPath });
            } else {
              try { if (scene.background) scene.background = null; } catch {}
              console.log("[JadeV4] ✅ 背景 HDR 加载(供折射瞬时取样)，scene.background=null", { path: backgroundHdrPath });
            }
          } catch (e) {
            console.error("[JadeV4] 背景 HDR 处理失败:", e);
          }
        },
        undefined,
        (err) => {
          console.error("[JadeV4] 加载背景 HDR 失败:", err);
        }
      );
    } catch (e) {
      console.error("[JadeV4] RGBELoader 异常(background):", e);
    }
    return () => {
      disposed = true;
      try {
        if (scene.background === bgTexture) {
          scene.background = null;
        }
      } catch {}
    };
  }, [backgroundHdrPath, backgroundColor, showBackground, scene]);

  // 初始化离屏 RT（用于屏幕后折射的近场采样）
  useEffect(() => {
    if (!useDualPassRefraction) return;
    try {
      const rt = new THREE.WebGLRenderTarget(size.width, size.height, {
        samples: 0,
        depthBuffer: false,
        stencilBuffer: false,
      });
      rt.texture.minFilter = THREE.LinearFilter;
      rt.texture.magFilter = THREE.LinearFilter;
      rt.texture.generateMipmaps = false;
      rtRef.current = rt;
      setRefractionMap(rt.texture);
      console.log('[JadeV4] ✅ 初始化离屏 RT 用于折射', { w: size.width, h: size.height });
      return () => { rt.dispose(); rtRef.current = null; };
    } catch (e) {
      console.error('[JadeV4] 创建离屏 RT 失败:', e);
    }
  }, [useDualPassRefraction, size.width, size.height]);

  // 每帧渲染 offscreen：只渲染背景 HDR（不包含当前几何），得到 tSceneBg 供折射采样
  useFrame(() => {
    if (!useDualPassRefraction) return;
    if (!rtRef.current) return;
    if (!bgTexture) return;
    const offScene = new THREE.Scene();
    offScene.background = bgTexture;
    try {
      gl.setRenderTarget(rtRef.current);
      gl.clearColor();
      gl.render(offScene, camera);
      gl.setRenderTarget(null);
    } catch (e) {
      // 静默失败不阻塞
    }
  });

  // 加载法线贴图（可选）
  useEffect(() => {
    let disposed = false;
    if (!normalMapPath) return;
    const loader = new THREE.TextureLoader();
    try {
      loader.load(
        normalMapPath,
        (tex) => {
          if (disposed) return;
          try {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            setNormalMap(tex);
          } catch (e) {
            console.error("[JadeV4] 处理法线贴图失败:", e);
          }
        },
        undefined,
        (err) => {
          console.warn("[JadeV4] 法线贴图加载失败(非致命):", err);
        }
      );
    } catch (e) {
      console.warn("[JadeV4] TextureLoader 异常(法线):", e);
    }
    return () => { disposed = true; };
  }, [normalMapPath]);

  // 创建材质（优先使用 SSR 双通道；否则回退 Physical）
  const material = useMemo(() => {
    if (!envMap) return null;
    try {
      // 当开启调试强制反射时，使用标准材质直观验证 env 是否进入
      if (debugForceReflection) {
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color as any),
          metalness: 0.0,
          roughness: 0.15,
          envMap: envMap,
          envMapIntensity: Math.max(2.0, envMapIntensity),
        });
        try {
          console.log("[JadeV4] DEBUG reflection material created", {
            hasEnvMap: !!envMap,
            envMapUUID: envMap.uuid,
          });
        } catch {}
        return mat;
      }

      // 优先：SSR 屏幕后折射材质（背景解耦）
      if (useDualPassRefraction && refractionMap) {
        try {
          const mat = createScreenSpaceRefractionMaterial({
            refractionMap: refractionMap,
            ior,
            refractionStrength: 1.0,
            thickness,
            roughness,
            normalMap: normalMap ?? undefined,
            normalScale,
            useEdgeFade: true,
            renderResolution: { x: size.width, y: size.height },
            gain: refractionGain,
            tint: (refractionTint as any) ?? 0xffffff,
            tintStrength: refractionTintStrength,
            offsetBoost: refractionOffsetBoost,
            baseMix: refractionBaseMix,
            gamma: refractionGamma,
          });
          (mat.uniforms as any).uDebugMode.value = 0;
          console.log('[JadeV4] ✅ 启用 SSR 折射材质');
          return mat as unknown as THREE.Material;
        } catch (e) {
          console.warn('[JadeV4] 创建 SSR 材质失败，回退到 Physical:', e);
        }
      }

      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color as any),
        metalness,
        roughness,
        transmission,
        ior,
        reflectivity,
        thickness,
        envMap,
        envMapIntensity,
        clearcoat,
        clearcoatRoughness,
        normalMap: normalMap || undefined,
        normalScale: normalMap ? new THREE.Vector2(normalScale, normalScale) : undefined,
        clearcoatNormalMap: normalMap || undefined,
        clearcoatNormalScale: normalMap ? new THREE.Vector2(normalScale, normalScale) : undefined,
      });
      // 同时显式绑定到材质 envMap，确保 transmission 采样可见
      try {
        (mat as any).envMap = envMap;
        mat.envMapIntensity = envMapIntensity;
        mat.needsUpdate = true;
      } catch {}
      // 调试：确认 envMap 已绑定
      try {
        console.log("[JadeV4] material created", {
          hasEnvMap: !!envMap,
          envMapUUID: envMap.uuid,
          envMapIntensity,
          transmission,
          roughness,
        });
      } catch {}

      // 不再注入自定义 transmission，避免破坏 three 能量管线
      return mat;
    } catch (e) {
      console.error("[JadeV4] 创建材质失败:", e);
      return null;
    }
  }, [envMap, color, metalness, roughness, transmission, ior, reflectivity, thickness, envMapIntensity, clearcoat, clearcoatRoughness, normalMap, normalScale, debugForceReflection, useDualPassRefraction, refractionMap, size.width, size.height]);

  useFrame((_, delta) => {
    if (!enableRotation) return;
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }
  });

  useEffect(() => {
    if (geometry && envMap) {
      setLoading(false);
    }
  }, [geometry, envMap]);

  if (loading) {
    return (
      <group>
        <mesh>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshBasicMaterial color="#666666" wireframe />
        </mesh>
      </group>
    );
  }

  if (error || !geometry || !material) {
    console.error("[JadeV4] 渲染失败:", error);
    return (
      <group>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#ff0000" wireframe />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={geometry} material={material} />
    </group>
  );
}

export default function JadeV4(props: JadeV4Props) {
  const { hdrExposure = 1.5, showBackground = true, enableRotation = true } = props;
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 45 }}
      onCreated={({ gl }) => {
        try {
          gl.toneMapping = THREE.ACESFilmicToneMapping as any;
          (gl as any).outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMappingExposure = hdrExposure;
          // 这行可选：提高 PBR 一致性
          (gl as any).physicallyCorrectLights = true;
          console.log('[JadeV4] ✅ renderer configured (ACES + sRGB + exposure)');
        } catch (e) {
          console.warn('[JadeV4] 渲染器配置失败:', e);
        }
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <Suspense fallback={null}>
        <JadeV4Content
          {...props}
          showBackground={showBackground}
          enableRotation={enableRotation}
        />
      </Suspense>
    </Canvas>
  );
}


