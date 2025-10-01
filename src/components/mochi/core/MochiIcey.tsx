'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

export interface MochiIceyProps {
  modelPath?: string;
  thicknessMapUrl?: string;
  thicknessRepeat?: [number, number];
  thicknessPower?: number;
  thicknessScale?: number;
  thicknessDistortion?: number;
  thicknessAmbient?: number;
  roughness?: number;
  metalness?: number;
  baseColor?: string;
}

/**
 * MochiIcey
 * 基于“厚度驱动的背光散射”近似（参考 IceMaterial）的 ShaderMaterial。
 * 目标：营造“半透明麻薯”的糯感与柔和背光，不做真实 transmission 折射。
 */
export default function MochiIcey(props: MochiIceyProps) {
  const {
    modelPath = '/models/10k_obj/001_空.obj',
    thicknessMapUrl,
    thicknessRepeat = [1, 1],
    // 按文档建议的更“糯”的默认区间
    thicknessPower = 4.0,
    thicknessScale = 1.2,
    thicknessDistortion = 0.1,
    thicknessAmbient = 0.12,
    roughness = 0.9,
    metalness = 0.0,
    baseColor = '#ffd4e5'
  } = props || {};

  // 重要：useLoader 会缓存同一路径的结果，若同场景多处使用需要深拷贝
  const objOriginal = useLoader(OBJLoader, modelPath);
  const obj = useMemo(() => objOriginal.clone(true), [objOriginal]);

  // 加载 thickness 贴图（可选）
  const thicknessTexture = useMemo(() => {
    try {
      if (thicknessMapUrl) {
        const tex = new THREE.TextureLoader().load(thicknessMapUrl);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
      }
    } catch (err) {
      // ignore
    }
    // 始终提供一个 1x1 的占位纹理，避免 null 导致的 uniform 设置错误
    const data = new Uint8Array([255, 255, 255, 255]);
    const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, [thicknessMapUrl]);

  const shader = useMemo(() => {
    const uniforms = {
      // 基础 PBR 基线（简单近似，主要用漫反射通道）
      uBaseColor: { value: new THREE.Color(baseColor) },
      uRoughness: { value: roughness },
      uMetalness: { value: metalness },
      // 透光近似参数
      uThicknessMap: { value: thicknessTexture },
      uThicknessRepeat: { value: new THREE.Vector2(thicknessRepeat[0], thicknessRepeat[1]) },
      uThicknessPower: { value: thicknessPower },
      uThicknessScale: { value: thicknessScale },
      uThicknessDistortion: { value: thicknessDistortion },
      uThicknessAmbient: { value: thicknessAmbient },
      uUseThicknessMap: { value: thicknessMapUrl ? 1.0 : 0.0 },
      // 简化光照（方向光与背光）默认值
      uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uLightColor: { value: new THREE.Color(1.0, 0.95, 0.9) },
      uBackLightDir: { value: new THREE.Vector3(-0.6, 0.4, -0.7).normalize() },
      uBackLightColor: { value: new THREE.Color(1.0, 0.7, 0.5) },
      // 磨砂增强
      uScatterBlur: { value: 0.0015 },
      uDitherStrength: { value: 0.01 },
      uNormalNoiseAmp: { value: 0.035 }
    };

    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 wPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = wPos.xyz;
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * wPos;
      }
    `;

    const fragmentShader = `
      precision highp float;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;

      uniform vec3 uBaseColor;
      uniform float uRoughness;
      uniform float uMetalness;

      uniform sampler2D uThicknessMap;
      uniform vec2 uThicknessRepeat;
      uniform float uThicknessPower;
      uniform float uThicknessScale;
      uniform float uThicknessDistortion;
      uniform float uThicknessAmbient;
      uniform float uUseThicknessMap;
      uniform float uScatterBlur;      // 0.001~0.003 小半径
      uniform float uDitherStrength;   // 0.005~0.02 轻噪
      uniform float uNormalNoiseAmp;   // 0.02~0.05 微法线幅度
      // 简单哈希噪声
      float hash21(vec2 p){
        p = fract(p*vec2(123.34, 456.21));
        p += dot(p, p+78.233);
        return fract(p.x*p.y);
      }

      // 3x3 厚度采样，模拟小半径散射模糊
      float blurThickness(vec2 uv){
        float r = uScatterBlur;
        vec2 o[9];
        o[0]=vec2(-r,-r); o[1]=vec2(0.,-r); o[2]=vec2(r,-r);
        o[3]=vec2(-r, 0.); o[4]=vec2(0., 0.); o[5]=vec2(r, 0.);
        o[6]=vec2(-r, r);  o[7]=vec2(0., r);  o[8]=vec2(r, r);
        float s=0.0; for(int i=0;i<9;i++){ s+= texture2D(uThicknessMap, uv * uThicknessRepeat + o[i]).r; }
        return s/9.0;
      }

      // 简化光照：主光+背光（避免 three 内置 lights 依赖导致的 uniform 不匹配）
      uniform vec3 uLightDir;       // 归一化方向（世界空间，指向物体）
      uniform vec3 uLightColor;
      uniform vec3 uBackLightDir;   // 归一化方向（轮廓背光）
      uniform vec3 uBackLightColor;

      float punctualLightIntensityToIrradianceFactor( const float lightDistance, const float cutoffDistance, const float decayExponent ) {
        if( decayExponent > 0.0 ) {
          float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
          if( cutoffDistance > 0.0 ) {
            distanceFalloff *= pow( clamp( 1.0 - lightDistance / cutoffDistance, 0.0, 1.0 ), decayExponent );
          }
          return distanceFalloff;
        }
        return 1.0;
      }

      void main() {
        // 基础漫反射色（食物基色：奶白/米白）
        vec3 base = uBaseColor;

        // 法线/视线/世界坐标
        // 微法线扰动：基于世界坐标的细噪
        vec3 N = normalize(vNormal);
        vec3 np = vWorldPos * 12.0;
        float nx = hash21(np.yz);
        float ny = hash21(np.zx);
        float nz = hash21(np.xy);
        N = normalize(N + uNormalNoiseAmp * (vec3(nx, ny, nz) - 0.5));
        vec3 V = normalize(cameraPosition - vWorldPos);

        // 厚度贴图：有占位纹理，可直接采样；是否启用由 uUseThicknessMap 控制
        float thicknessTex = texture2D(uThicknessMap, vUv * uThicknessRepeat).r;
        // 小半径模糊增强“糯感”
        thicknessTex = mix(thicknessTex, blurThickness(vUv), 0.6);

        // 简单环境底色（不依赖 three 内置 ambient uniform，避免未定义）
        vec3 color = base * (0.25 + uThicknessAmbient);

        // 主光：漫反-近似
        {
          vec3 L = normalize(uLightDir);
          float ndotl = max(dot(N, L), 0.0);
          color += base * uLightColor * ndotl * 0.5;
        }

        // 背光：厚度驱动的“透光叶瓣”
        {
          vec3 L = normalize(uBackLightDir);
          vec3 LT = normalize(L + N * uThicknessDistortion);
          float lobe = pow(clamp(dot(V, -LT), 0.0, 1.0), uThicknessPower) * uThicknessScale;
          lobe = min(lobe, 1.0);
          lobe *= 0.8; // 适当限能，防止刺白
          float t = mix(1.0, thicknessTex, step(0.5, uUseThicknessMap));
          vec3 sss = base * (lobe + uThicknessAmbient) * t;
          color += sss * uBackLightColor;
        }

        // 轻微粗糙度：用简单的 wrap 漫反射柔化（不做高光，避免“冰/玻璃感”）
        // 注意：这不是物理正确，仅为审美目的

        // Fresnel → Alpha：边缘更透（而不是增亮）
        float fres = 1.0 - max(dot(N, V), 0.0);
        float rim  = smoothstep(0.08, 0.80, fres + fwidth(fres) * 1.5);
        float alphaCore = 1.0;
        float alphaEdge = 0.30;
        float alpha = mix(alphaCore, alphaEdge, rim);

        // 轻噪抖动，打散色带
        float dn = hash21(gl_FragCoord.xy * 0.5);
        color *= (1.0 + uDitherStrength * (dn - 0.5));
        alpha  *= (1.0 + uDitherStrength * (dn - 0.5));

        gl_FragColor = vec4(color, alpha);
      }
    `;

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      lights: false,
      fog: false,
      transparent: true,
    });

    // 尽量关闭强镜面以避免偏玻璃
    material.extensions.derivatives = false as any;
    return material;
  }, [
    baseColor,
    roughness,
    metalness,
    thicknessTexture,
    thicknessRepeat[0],
    thicknessRepeat[1],
    thicknessPower,
    thicknessScale,
    thicknessDistortion,
    thicknessAmbient
  ]);

  // 统一几何：平滑法线、居中、缩放到半径≈1（烘焙进几何，避免 normalMatrix 误差）
  obj.traverse((child: any) => {
    try {
      if (child.isMesh) {
        const geo = (child.geometry as THREE.BufferGeometry).clone();
        geo.computeVertexNormals();
        geo.computeBoundingBox();
        const bbox = geo.boundingBox!;
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const target = 2.0; // 直径=2 → 半径≈1
        const scale = target / (maxDim || 1);
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        const matrix = new THREE.Matrix4();
        matrix.makeTranslation(-center.x, -center.y, -center.z);
        matrix.scale(new THREE.Vector3(scale, scale, scale));
        geo.applyMatrix4(matrix);
        geo.computeVertexNormals();
        geo.computeBoundingSphere();

        child.scale.set(1, 1, 1);
        child.position.set(0, 0, 0);
        child.rotation.set(0, 0, 0);
        child.updateMatrixWorld(true);

        child.material = shader;
        child.renderOrder = 1;
      }
    } catch (e) {
      // 忽略单个子网格失败
    }
  });

  return <primitive object={obj} />;
}


