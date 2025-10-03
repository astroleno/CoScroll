import * as THREE from 'three';

export interface SSRUniforms {
  refractionMap: THREE.Texture | null;
  ior: number;
  refractionStrength: number;
  thickness: number;
  roughness: number; // 新增：用于控制模糊强度
  normalMap?: THREE.Texture | null;
  normalScale: number;
  useEdgeFade: boolean;
  renderResolution: { x: number; y: number };
  // 亮度/色调控制（可选）
  gain?: number;                // 提升整体亮度（默认 1.0）
  tint?: THREE.Color | number;  // 颜色微调（默认白色，不改变）
  tintStrength?: number;        // 0-1，颜色微调强度（默认 0）
  offsetBoost?: number;         // 折射偏移强度（默认 3.0）
  baseMix?: number;             // 与基色混合，防止纯黑（默认 0.35）
  gamma?: number;               // 简易伽马矫正（默认 1.0 不变）
}

export function createScreenSpaceRefractionMaterial(uniformValues: SSRUniforms): THREE.ShaderMaterial {
  const uniforms = {
    uRefractionMap: { value: uniformValues.refractionMap },
    uHasRefractionMap: { value: uniformValues.refractionMap ? 1 : 0 },
    uIOR: { value: uniformValues.ior },
    uStrength: { value: uniformValues.refractionStrength },
    uThickness: { value: uniformValues.thickness },
    uRoughness: { value: uniformValues.roughness }, // 新增
    uNormalMap: { value: uniformValues.normalMap ?? null },
    uHasNormalMap: { value: uniformValues.normalMap ? 1 : 0 },
    uNormalScale: { value: uniformValues.normalScale },
    uUseEdgeFade: { value: uniformValues.useEdgeFade ? 1 : 0 },
    uRenderResolution: { value: new THREE.Vector2(uniformValues.renderResolution.x, uniformValues.renderResolution.y) },
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color(0x444444) }, // 深灰色，避免 Fresnel 过亮
    uGain: { value: uniformValues.gain ?? 1.0 },
    uTint: { value: new THREE.Color((uniformValues.tint as any) ?? 0xffffff) },
    uTintStrength: { value: uniformValues.tintStrength ?? 0.0 },
    // Debug/visibility helpers
    uDebugMode: { value: 0 },               // 1=输出纯红用于验证是否走到 SSR
    uOffsetBoost: { value: uniformValues.offsetBoost ?? 3.0 },           // 放大折射偏移，便于观察
    uBaseMix: { value: uniformValues.baseMix ?? 0.35 },
    uGamma: { value: uniformValues.gamma ?? 1.0 },
  };

  const vertex = `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main(){
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragment = `
    uniform sampler2D uRefractionMap;
    uniform int uHasRefractionMap;
    uniform float uIOR;
    uniform float uStrength;
    uniform float uThickness;
    uniform float uRoughness; // 新增：控制模糊强度
    uniform sampler2D uNormalMap;
    uniform int uHasNormalMap;
    uniform float uNormalScale;
    uniform int uUseEdgeFade;
    uniform vec2 uRenderResolution;
    uniform vec3 uBaseColor;
    uniform float uGain;
    uniform vec3 uTint;
    uniform float uTintStrength;
    uniform float uBaseMix;
    uniform float uGamma;
    uniform int uDebugMode;
    uniform float uOffsetBoost;
    varying vec2 vUv;
    varying vec3 vNormal;

    // 近似视线方向（屏幕空间）
    vec3 getViewDir(){
      // 在屏幕空间近似：Z 朝外，使用法线与固定视线
      return normalize(vec3(0.0, 0.0, 1.0));
    }

    // 法线扰动（若提供 normalMap 则使用切线空间简单近似）
    vec3 perturbNormal(vec2 uv, vec3 n){
      if (uNormalScale <= 0.0 || uHasNormalMap == 0) return n;
      vec3 mapN = texture2D(uNormalMap, uv).xyz * 2.0 - 1.0;
      mapN.xy *= uNormalScale;
      vec3 t = normalize(vec3(1.0, 0.0, 0.0));
      vec3 b = normalize(cross(n, t));
      t = normalize(cross(b, n));
      mat3 tbn = mat3(t, b, n);
      vec3 nWorld = normalize(tbn * mapN);
      return nWorld;
    }

    void main(){
      // Debug 模式 1: 纯红色，验证 shader 是否被调用
      if (uDebugMode == 1){ gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); return; }
      
      // Debug 模式 2: 直接输出 UV 坐标（红绿渐变）
      if (uDebugMode == 2){ gl_FragColor = vec4(vUv, 0.0, 1.0); return; }
      
      // Debug 模式 3: 直接采样 refractionMap 中心点
      if (uDebugMode == 3){ 
        vec3 raw = texture2D(uRefractionMap, vec2(0.5, 0.5)).rgb;
        gl_FragColor = vec4(raw, 1.0);
        return; 
      }
      
      // Debug 模式 4: 使用当前片段的屏幕 UV 直接采样（不做折射偏移）
      if (uDebugMode == 4){
        vec2 fragCoord = gl_FragCoord.xy;
        vec2 uvScreen = fragCoord / uRenderResolution;
        vec3 raw = texture2D(uRefractionMap, uvScreen).rgb;
        gl_FragColor = vec4(raw, 1.0);
        return;
      }
      
      if (uHasRefractionMap == 0){
        gl_FragColor = vec4(uBaseColor, 1.0);
        return;
      }

      vec2 fragCoord = gl_FragCoord.xy; // 像素
      vec2 uvScreen = fragCoord / uRenderResolution; // 0..1

      vec3 N = normalize(vNormal);
      if (uNormalScale > 0.0) {
        N = perturbNormal(vUv, N);
      }

      vec3 V = getViewDir();
      // 折射近似（屏幕空间）：根据 IOR 与厚度将 UV 偏移
      float eta = 1.0 / max(1e-3, uIOR);
      vec3 R = refract(-V, N, eta);
      vec2 offset = R.xy * uStrength * uThickness * (0.25 * uOffsetBoost);
      vec2 uv = uvScreen + offset;

    // 越界处理 + 边缘衰减
      vec2 clampedUv = clamp(uv, vec2(0.0), vec2(1.0));
      float edge = 1.0;
      if (uUseEdgeFade == 1){
        vec2 d = abs(uv - clampedUv);
        float m = max(d.x, d.y);
        edge = 1.0 - smoothstep(0.0, 0.01, m);
      }

    // 根据 roughness 进行模糊采样（改进的 box blur）
    vec3 refracted = vec3(0.0);
    float blurRadius = uRoughness * 0.05; // 增大模糊半径（从 0.015 提升到 0.05）
    vec2 texelSize = 1.0 / uRenderResolution; // 单个像素大小
    
    if (uRoughness < 0.01) {
      // roughness 接近 0，直接采样（无模糊）
      refracted = texture2D(uRefractionMap, clampedUv).rgb;
    } else {
      // 5x5 box blur（25 次采样，更柔和的模糊）
      float totalWeight = 0.0;
      for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
          vec2 offset = vec2(float(x), float(y)) * blurRadius * texelSize;
          vec2 sampleUv = clamp(clampedUv + offset, vec2(0.0), vec2(1.0));
          refracted += texture2D(uRefractionMap, sampleUv).rgb;
          totalWeight += 1.0;
        }
      }
      refracted /= totalWeight; // 平均
    }
    
    // 直接显示折射效果
    vec3 color = refracted;
    color = mix(color, uTint, clamp(uTintStrength, 0.0, 1.0));
    color *= max(0.0, uGain);
    if (uGamma > 0.01) {
      color = pow(max(color, 0.0), vec3(1.0 / uGamma));
    }
    color = mix(uBaseColor, color, clamp(uBaseMix, 0.0, 1.0));
    color *= edge;
    gl_FragColor = vec4(color, 1.0);
    }
  `;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: false,
  });

  return mat;
}


