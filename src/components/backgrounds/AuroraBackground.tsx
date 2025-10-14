"use client";

import React, { useEffect, useRef, useState } from "react";
import { Renderer, Program, Mesh, Color, Triangle } from "ogl";

/**
 * AuroraBackground (OGL 版本)
 * - 与 `auroraref.tsx` 保持同源着色器思路，但封装成我们统一的背景组件接口。
 * - 特性：固定定位全屏、pointer-events: none、支持颜色/强度/速度配置、reduced-motion/移动端降级。
 */

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;
uniform float uNoiseScale;     // 颜色/形态噪声缩放
uniform float uColorJitter;    // 色带抖动强度（0-1）
uniform float uDualBands;      // 是否启用上下双带（0/1）
uniform float uUseSketch;      // 是否启用 sketch1732356 风格配色噪声（0/1）
uniform float uExposure;       // 曝光（整体增益）
uniform float uGamma;          // 伽马矫正
uniform float uCenterVignette; // 中心暗角强度（0-1）
uniform float uHighlightClamp; // 亮部上限（0-1），防止过曝发白

out vec4 fragColor;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// fractal brownian motion（简单三层叠加）
float fbm(vec2 p) {
  float f = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    f += a * snoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return f;
}

struct ColorStop { vec3 color; float position; };
#define COLOR_RAMP(colors, factor, finalColor) { \
  int index = 0; for (int i = 0; i < 2; i++) { ColorStop currentColor = colors[i]; bool isInBetween = currentColor.position <= factor; index = int(mix(float(index), float(i), float(isInBetween))); } \
  ColorStop currentColor = colors[index]; ColorStop nextColor = colors[index + 1]; float range = nextColor.position - currentColor.position; float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); }

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);
  // 沿 x 方向取色，但加入噪声抖动，避免可预测条带
  float xJitter = uColorJitter * fbm(uv * uNoiseScale + vec2(uTime * 0.03, 0.0));
  vec3 rampColor; COLOR_RAMP(colors, clamp(uv.x + xJitter, 0.0, 1.0), rampColor);

  // 若启用 sketch 风格：用三相位噪声映射到三色
  if (uUseSketch > 0.5) {
    vec2 st = uv * 2.0 - 1.0;
    vec3 dir = normalize(vec3(st, 1.0));
    vec3 fb = vec3(
      snoise(dir.xy * (1.5 * uNoiseScale) + vec2(0.00, -uTime * 0.10)),
      snoise(dir.xy * (1.5 * uNoiseScale) + vec2(0.10, -uTime * 0.12)),
      snoise(dir.xy * (1.5 * uNoiseScale) + vec2(0.20, -uTime * 0.14))
    );
    vec3 n = sin(fb * 2.0) * 0.5 + 0.75;
    n = pow(n, vec3(4.0));
    // 三色加权融合并带入轻微纵向遮罩，形成上下都有的能量带
    float maskY = 0.80 + 0.20 * (1.0 - abs(st.y));
    // 中心暗角，压低中央过曝
    float vignette = 1.0 - smoothstep(0.0, 0.8, length(st));
    float centerMask = mix(1.0, vignette, clamp(uCenterVignette, 0.0, 1.0));

    vec3 col = n.x * uColorStops[0] + n.y * uColorStops[1] + n.z * uColorStops[2];
    col *= maskY * centerMask;
    // 轻微去饱和，向三色平均靠拢，减少刺眼白芯
    vec3 avgC = (uColorStops[0] + uColorStops[1] + uColorStops[2]) / 3.0;
    col = mix(col, avgC, 0.15);
    // 曝光/伽马与高光压制（Reinhard + clamp）
    col *= uExposure;
    col = col / (1.0 + col);
    col = min(col, vec3(uHighlightClamp));
    col = pow(max(col, vec3(0.0)), vec3(1.0 / max(0.0001, uGamma)));
    // 四边轻微羽化，减弱条带硬边
    float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    float edgeFeather = smoothstep(0.0, 0.08, edge); // 8% 边缘羽化
    col *= mix(0.95, 1.0, edgeFeather);
    float alpha = 1.0; // 背景层
    fragColor = vec4(col, alpha);
    return;
  }

  // 顶部带：根据 y 方向与噪声决定高度与强度
  float nTop = fbm(vec2(uv.x * (1.5 * uNoiseScale) + uTime * 0.05, uTime * 0.2));
  float heightTop = exp(nTop * 0.6 * uAmplitude);
  float intensityTop = 0.6 * (uv.y * 2.0 - heightTop + 0.2);

  // 底部带：镜像 y，并引入独立噪声偏移
  float nBot = fbm(vec2(uv.x * (1.7 * uNoiseScale) - uTime * 0.04, -uTime * 0.18) + 3.17);
  float heightBot = exp(nBot * 0.6 * uAmplitude);
  float yMirror = (1.0 - uv.y);
  float intensityBot = 0.6 * (yMirror * 2.0 - heightBot + 0.2);

  float midPoint = 0.20;
  float alphaTop = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensityTop);
  float alphaBot = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensityBot);

  vec3 colorTop = intensityTop * rampColor;
  vec3 colorBot = intensityBot * rampColor;
  vec3 color = mix(colorTop, colorTop + colorBot, step(0.5, uDualBands));
  float alpha = mix(alphaTop, max(alphaTop, alphaBot), step(0.5, uDualBands));
  fragColor = vec4(color * alpha, alpha);
}`;

export type AuroraBackgroundProps = {
  color1?: string;
  color2?: string;
  color3?: string;
  amplitude?: number;
  blend?: number;
  speed?: number;
  noiseScale?: number;
  colorJitter?: number;
  dualBands?: boolean;
  useSketchStyle?: boolean;
  exposure?: number;        // 曝光（<1 更暗）
  gamma?: number;           // 伽马（>1 提升暗部）
  centerVignette?: number;  // 中心暗角强度 0-1
  highlightClamp?: number;  // 亮部最大值 0-1
  animate?: boolean;
  forceAnimation?: boolean;
  mobileOptimize?: boolean;
  className?: string;
  style?: React.CSSProperties;
  zIndex?: number;
  pointerEvents?: React.CSSProperties["pointerEvents"];
};

const DEFAULT_COLOR_1 = "#194f67";
const DEFAULT_COLOR_2 = "#3c315e";
const DEFAULT_COLOR_3 = "#3e4e8e";

export default function AuroraBackground(props: AuroraBackgroundProps) {
  const {
    color1 = DEFAULT_COLOR_1,
    color2 = DEFAULT_COLOR_2,
    color3 = DEFAULT_COLOR_3,
    amplitude = 1.1,
    blend = 0.55,
    speed = 1.0,
    noiseScale = 1.0,
    colorJitter = 0.15,
    dualBands = true,
    exposure = 0.75,
    gamma = 1.2,
    centerVignette = 0.6,
    highlightClamp = 0.85,
    animate = true,
    forceAnimation = false,
    mobileOptimize = true,
    className,
    style,
    zIndex = 0,
    pointerEvents = "none",
    useSketchStyle = true,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState<boolean>(true);

  // 动画偏好与移动端降级
  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const preferReduce = mq.matches;
      const isMobile = window.innerWidth < 768;
      if (forceAnimation) {
        setShouldAnimate(true);
      } else if (!animate) {
        setShouldAnimate(false);
      } else if (preferReduce) {
        setShouldAnimate(false);
      } else if (mobileOptimize && isMobile) {
        setShouldAnimate(false);
      } else {
        setShouldAnimate(true);
      }
    } catch (e) {
      setShouldAnimate(animate);
    }
  }, [animate, forceAnimation, mobileOptimize]);

  useEffect(() => {
    const ctn = containerRef.current;
    if (!ctn) return;

    let renderer: Renderer | undefined;
    let gl: WebGL2RenderingContext | WebGLRenderingContext | any;
    try {
      renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true });
      gl = renderer.gl;
    } catch (error) {
      console.warn("AuroraBackground(OGL): 初始化失败，将跳过渲染", error);
      return;
    }
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.backgroundColor = "transparent";

    let program: Program | undefined;

    const resize = () => {
      try {
        if (!renderer) return;
        const width = Math.max(1, ctn.offsetWidth);
        const height = Math.max(1, ctn.offsetHeight);
        const dpr = Math.min(window.devicePixelRatio || 1, 1.8);
        (renderer as any).dpr = dpr;
        renderer.setSize(width, height);
        if (program) program.uniforms.uResolution.value = [width, height];
      } catch (err) {
        console.warn("AuroraBackground: resize 失败", err);
      }
    };
    const ro = (window as any).ResizeObserver ? new (window as any).ResizeObserver(resize) : null;
    ro?.observe(ctn);
    window.addEventListener("resize", resize);

    const geometry = new Triangle(gl);
    if ((geometry as any).attributes?.uv) {
      delete (geometry as any).attributes.uv;
    }

    const colorStopsArray = [color1, color2, color3].map((hex) => {
      const c = new Color(hex);
      return [c.r, c.g, c.b];
    });

    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitude },
        uColorStops: { value: colorStopsArray },
        uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
        uBlend: { value: blend },
        uNoiseScale: { value: noiseScale },
        uColorJitter: { value: colorJitter },
        uDualBands: { value: dualBands ? 1.0 : 0.0 },
        uUseSketch: { value: useSketchStyle ? 1.0 : 0.0 },
        uExposure: { value: exposure },
        uGamma: { value: gamma },
        uCenterVignette: { value: centerVignette },
        uHighlightClamp: { value: highlightClamp },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    gl.canvas.style.position = "absolute";
    gl.canvas.style.inset = "0";
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    gl.canvas.style.pointerEvents = String(pointerEvents);
    gl.canvas.style.zIndex = String(zIndex);
    ctn.appendChild(gl.canvas);

    let rafId = 0;
    const update = (t: number) => {
      rafId = requestAnimationFrame(update);
      try {
        const time = (t * 0.01) * (shouldAnimate ? speed : 0);
        if (program) {
          program.uniforms.uTime.value = time * 0.1;
          program.uniforms.uAmplitude.value = amplitude;
          program.uniforms.uBlend.value = blend;
          program.uniforms.uNoiseScale.value = noiseScale;
          program.uniforms.uColorJitter.value = colorJitter;
          program.uniforms.uDualBands.value = dualBands ? 1.0 : 0.0;
          program.uniforms.uUseSketch.value = useSketchStyle ? 1.0 : 0.0;
          program.uniforms.uExposure.value = exposure;
          program.uniforms.uGamma.value = gamma;
          program.uniforms.uCenterVignette.value = centerVignette;
          program.uniforms.uHighlightClamp.value = highlightClamp;
          program.uniforms.uColorStops.value = [color1, color2, color3].map((hex: string) => {
            const c = new Color(hex);
            return [c.r, c.g, c.b];
          });
          renderer?.render({ scene: mesh });
        }
      } catch (err) {
        console.warn("AuroraBackground: 渲染失败", err);
      }
    };
    rafId = requestAnimationFrame(update);

    resize();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      ro?.disconnect?.();
      try {
        if (ctn && gl.canvas.parentNode === ctn) ctn.removeChild(gl.canvas);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {}
    };
  }, [color1, color2, color3, amplitude, blend, speed, shouldAnimate, zIndex, pointerEvents]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "fixed", inset: 0, zIndex, pointerEvents, ...style }}
      aria-hidden
    />
  );
}


