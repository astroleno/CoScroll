'use client';

import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * MochiBackground（直显版）：
 * - 使用屏幕空间 raymarch 渲染一个柔和“弥散球状体”作为背景演示
 * - 不依赖音频；仅基于时间做轻微流动
 * - 仅用于 /mochi-b 页面直观看到“球”效果
 */
export default function MochiBackground() {
  const { gl } = useThree();
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.OrthographicCamera>();
  const meshRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>>();

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  }), []);

  const material = useMemo(() => {
    const vert = `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    // 简化“弥散球状体”片元：屏幕空间 raymarch + 柔和边缘/体积感近似
    const frag = `
      precision highp float;
      varying vec2 vUv;
      uniform vec2 uResolution;
      uniform float uTime;

      // 基础 hash/noise
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        float a = hash(i + vec2(0.0,0.0));
        float b = hash(i + vec2(1.0,0.0));
        float c = hash(i + vec2(0.0,1.0));
        float d = hash(i + vec2(1.0,1.0));
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      float fbm(vec2 p){ float a=0.5,f=1.0,acc=0.0; for(int i=0;i<5;i++){acc+=a*noise(p*f); f*=2.0; a*=0.5;} return acc; }

      // 距离场：单个球体 + 轻微起伏
      float sdSphere(vec3 p, float r){ return length(p)-r; }

      // 估计法线
      vec3 estimateNormal(vec3 p){
        float e = 0.0015;
        vec2 h = vec2(e, 0.0);
        float d = sdSphere(p, 1.0);
        return normalize(vec3(
          sdSphere(p+vec3(h.x, h.y, h.y), 1.0) - d,
          sdSphere(p+vec3(h.y, h.x, h.y), 1.0) - d,
          sdSphere(p+vec3(h.y, h.y, h.x), 1.0) - d
        ));
      }

      void main(){
        vec2 uv = (gl_FragCoord.xy - 0.5*uResolution) / min(uResolution.x, uResolution.y);
        // 相机与射线
        vec3 ro = vec3(0.0, 0.0, 3.2);
        vec3 rd = normalize(vec3(uv, -1.6));

        // 轻微流动扰动（背景色）
        float t = uTime*0.25;
        float bg = fbm(uv*1.8 + vec2(0.0, t));
        vec3 bgA = vec3(0.09, 0.10, 0.13);
        vec3 bgB = vec3(0.28, 0.30, 0.55);
        vec3 col = mix(bgA, bgB, smoothstep(0.2, 0.9, bg));

        // raymarch 单球
        float tMin = 0.0; float tMax = 8.0; float tCur = tMin; bool hit=false; vec3 p=vec3(0.0);
        for(int i=0;i<96;i++){
          p = ro + rd * tCur;
          // 球半径 1.0，加轻微起伏
          float d = sdSphere(p, 1.0);
          d += (fbm(p.xy*1.5 + t*0.3) - 0.5) * 0.06;
          if(d < 0.001){ hit = true; break; }
          tCur += clamp(d, 0.01, 0.12);
          if(tCur > tMax) break;
        }

        if(hit){
          vec3 n = estimateNormal(p);
          // 漫反射 + 边缘光
          vec3 ldir = normalize(vec3(0.8, 0.9, -0.6));
          float diff = clamp(dot(n, ldir), 0.0, 1.0);
          float rim = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 2.0);
          vec3 base = vec3(0.65, 0.78, 0.92);
          vec3 albedo = mix(base*0.7, base, 0.6 + 0.4*fbm(p.xy*2.0));
          col = albedo * (0.25 + 0.75*diff) + vec3(0.1)*rim;
          // 柔化亮度，模拟弥散
          col = pow(col, vec3(0.9));
        }

        // vignette 轻微压暗
        float r = length(uv);
        col *= 1.0 - 0.12*pow(r, 2.0);
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `;

    return new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag });
  }, [uniforms]);

  // 初始化场景
  useEffect(() => {
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    const geo = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geo, material);
    scene.add(mesh);
    sceneRef.current = scene;
    cameraRef.current = cam;
    meshRef.current = mesh as any;
    return () => { geo.dispose(); material.dispose(); scene.clear(); };
  }, [material]);

  // 自适应分辨率
  useFrame((_, delta) => {
    if (!sceneRef.current || !cameraRef.current) return;
    uniforms.uTime.value += delta;
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    uniforms.uResolution.value.set(size.x, size.y);
    gl.autoClear = true;
    gl.render(sceneRef.current, cameraRef.current);
  }, 1);

  return null;
}


