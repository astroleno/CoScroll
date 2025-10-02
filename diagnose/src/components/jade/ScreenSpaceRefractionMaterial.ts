import * as THREE from 'three';

export interface SSRUniforms {
  refractionMap: THREE.Texture | null;
  ior: number;
  refractionStrength: number;
  thickness: number;
  normalMap?: THREE.Texture | null;
  normalScale: number;
  useEdgeFade: boolean;
  renderResolution: { x: number; y: number };
}

export function createScreenSpaceRefractionMaterial(uniformValues: SSRUniforms): THREE.ShaderMaterial {
  const uniforms = {
    uRefractionMap: { value: uniformValues.refractionMap },
    uHasRefractionMap: { value: uniformValues.refractionMap ? 1 : 0 },
    uIOR: { value: uniformValues.ior },
    uStrength: { value: uniformValues.refractionStrength },
    uThickness: { value: uniformValues.thickness },
    uNormalMap: { value: uniformValues.normalMap ?? null },
    uHasNormalMap: { value: uniformValues.normalMap ? 1 : 0 },
    uNormalScale: { value: uniformValues.normalScale },
    uUseEdgeFade: { value: uniformValues.useEdgeFade ? 1 : 0 },
    uRenderResolution: { value: new THREE.Vector2(uniformValues.renderResolution.x, uniformValues.renderResolution.y) },
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color(0xffffff) },
    // Debug/visibility helpers
    uDebugMode: { value: 0 },               // 1=输出纯红用于验证是否走到 SSR
    uOffsetBoost: { value: 3.0 },           // 放大折射偏移，便于观察（默认 3.0）
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
    uniform sampler2D uNormalMap;
    uniform int uHasNormalMap;
    uniform float uNormalScale;
    uniform int uUseEdgeFade;
    uniform vec2 uRenderResolution;
    uniform vec3 uBaseColor;
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
      if (uDebugMode == 1){ gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); return; }
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

    vec3 refracted = texture2D(uRefractionMap, clampedUv).rgb;

    // Fresnel 近似：中心更多折射，边缘更多反射（用基色近似环境反射）
    float F0 = pow((uIOR - 1.0) / (uIOR + 1.0), 2.0);
    float fresnel = F0 + (1.0 - F0) * pow(1.0 - max(0.0, dot(-V, N)), 5.0);
    vec3 reflectApprox = uBaseColor; // 如需更真实可与 envMap 反射项相乘
    vec3 color = mix(refracted, reflectApprox, fresnel);
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


