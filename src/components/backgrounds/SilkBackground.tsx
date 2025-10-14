"use client";

import React, { useEffect, useRef, useState } from "react";
import { Renderer, Program, Mesh, Triangle, Color } from "ogl";

/**
 * SilkBackground
 * - 参考 reactbits Silk 背景效果的视觉概念（柔和丝绸流动、色带渐变、轻颗粒），使用 OGL 全屏片元着色器实现。
 * - 作为独立固定定位背景层，pointer-events 默认 none，便于叠加在任意页面下方。
 * - 提供动画偏好与移动端降级；提供基础参数以适配不同主题颜色与动态程度。
 */

export type SilkBackgroundProps = {
  colorA?: string; // 渐变主色 A（左侧）
  colorB?: string; // 渐变主色 B（右侧）
  colorAccent?: string; // 强调色（用于丝绸高光调和）
  speed?: number; // 动画速度倍率（0 停止）
  noiseScale?: number; // 噪声缩放，影响波纹密度
  waveAmp?: number; // 丝绸形变强度
  exposure?: number; // 曝光（整体增益）
  gamma?: number; // 伽马校正
  grainAmount?: number; // 颗粒强度（0-1）
  grainScale?: number; // 颗粒缩放
  animate?: boolean; // 是否允许动画
  forceAnimation?: boolean; // 忽略 reduced-motion
  mobileOptimize?: boolean; // 移动端是否默认降级静态
  className?: string;
  style?: React.CSSProperties;
  zIndex?: number;
  pointerEvents?: React.CSSProperties["pointerEvents"];
};

const VERT = `#version 300 es
in vec2 position;
void main(){
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// 设计目标：
// 1) 柔和丝绸：用多频噪声驱动一个弯曲场，对 uv 进行流动偏移；
// 2) 色彩：左右渐变 + 强调色调和，配合曝光/伽马保持不过曝；
// 3) 粒子：极轻薄的 film grain，随时间微动；
// 4) 以性能为先，限定噪声叠加次数。
const FRAG = `#version 300 es
precision highp float;

out vec4 fragColor;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorAccent;
uniform float uSpeed;
uniform float uNoiseScale;
uniform float uWaveAmp;
uniform float uExposure;
uniform float uGamma;
uniform float uGrainAmount;
uniform float uGrainScale;

// 简单 hash 噪声（标量返回）
float hash(vec2 p){
  float h = sin(dot(p, vec2(127.1,311.7))) * 43758.5453123;
  return -1.0 + 2.0 * fract(h);
}

// 二维 value 噪声
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// 两层简化 fbm，偏向横向流动
float fbm(vec2 p){
  float v = 0.0;
  float a = 0.65;
  v += a * noise(p);
  p *= 2.02; a *= 0.5; v += a * noise(p);
  return v;
}

vec3 tonemap(vec3 c, float exposure){
  c *= exposure; // 简单 reinhard
  return c / (1.0 + c);
}

void main(){
  vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
  vec2 st = uv * 2.0 - 1.0;

  // 丝绸流动：对 uv 施加随时间的弯曲位移
  float t = uTime * uSpeed;
  float n1 = fbm(uv * uNoiseScale + vec2(0.18 * t, 0.0));
  float n2 = fbm(uv.yx * (uNoiseScale*0.85) + vec2(-0.12 * t, 0.06 * t));
  float curve = (n1 * 0.8 + n2 * 0.2);
  vec2 flowUV = uv + uWaveAmp * 0.12 * vec2(curve, -curve);

  // 左右渐变取色
  vec3 grad = mix(uColorA, uColorB, smoothstep(0.0, 1.0, flowUV.x));

  // 强调色按噪声权重轻混合，形成丝绸高光/阴影过渡
  float highlight = smoothstep(0.35, 0.95, curve);
  vec3 col = mix(grad, uColorAccent, 0.35 * highlight);

  // 轻微纵向遮罩，增强丝绸中心带
  float band = 0.80 + 0.20 * (1.0 - abs(st.y));
  col *= band;

  // tonemap + gamma
  col = tonemap(max(col, vec3(0.0)), uExposure);
  col = pow(max(col, vec3(0.0)), vec3(1.0 / max(0.0001, uGamma)));

  // film grain（按像素坐标与时间扰动）
  float grain = noise(gl_FragCoord.xy / max(1.0, uGrainScale) + vec2(23.17, 91.7) + t * 0.3);
  col += (grain * 2.0 - 1.0) * (0.08 * uGrainAmount);

  // 边缘细微羽化避免硬边
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float edgeFeather = smoothstep(0.0, 0.06, edge);
  col *= mix(0.97, 1.0, edgeFeather);

  fragColor = vec4(col, 1.0);
}`;

const DEFAULT_A = "#3b2d71"; // 深靛
const DEFAULT_B = "#1c6b7a"; // 蓝绿
const DEFAULT_ACCENT = "#e0b1ff"; // 柔紫高光

export default function SilkBackground(props: SilkBackgroundProps){
  const {
    colorA = DEFAULT_A,
    colorB = DEFAULT_B,
    colorAccent = DEFAULT_ACCENT,
    speed = 1.0,
    noiseScale = 1.1,
    waveAmp = 1.0,
    exposure = 0.9,
    gamma = 1.2,
    grainAmount = 0.25,
    grainScale = 800.0,
    animate = true,
    forceAnimation = false,
    mobileOptimize = true,
    className,
    style,
    zIndex = 0,
    pointerEvents = "none",
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldAnimate, setShouldAnimate] = useState(true);

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
      console.warn("SilkBackground: 初始化 WebGL 失败，跳过渲染", error);
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
        console.warn("SilkBackground: resize 失败", err);
      }
    };
    const ro = (window as any).ResizeObserver ? new (window as any).ResizeObserver(resize) : null;
    ro?.observe(ctn);
    window.addEventListener("resize", resize);

    const geometry = new Triangle(gl);
    if ((geometry as any).attributes?.uv) {
      delete (geometry as any).attributes.uv;
    }

    const colA = new Color(colorA);
    const colB = new Color(colorB);
    const colAcc = new Color(colorAccent);

    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
        uColorA: { value: [colA.r, colA.g, colA.b] },
        uColorB: { value: [colB.r, colB.g, colB.b] },
        uColorAccent: { value: [colAcc.r, colAcc.g, colAcc.b] },
        uSpeed: { value: speed },
        uNoiseScale: { value: noiseScale },
        uWaveAmp: { value: waveAmp },
        uExposure: { value: exposure },
        uGamma: { value: gamma },
        uGrainAmount: { value: grainAmount },
        uGrainScale: { value: grainScale },
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
        const time = (t * 0.001) * (shouldAnimate ? 1.0 : 0.0);
        if (program) {
          program.uniforms.uTime.value = time;
          program.uniforms.uSpeed.value = speed;
          program.uniforms.uNoiseScale.value = noiseScale;
          program.uniforms.uWaveAmp.value = waveAmp;
          program.uniforms.uExposure.value = exposure;
          program.uniforms.uGamma.value = gamma;
          program.uniforms.uGrainAmount.value = grainAmount;
          program.uniforms.uGrainScale.value = grainScale;
          // 实时颜色更新，便于热替换
          const ca = new Color(colorA); const cb = new Color(colorB); const cc = new Color(colorAccent);
          program.uniforms.uColorA.value = [ca.r, ca.g, ca.b];
          program.uniforms.uColorB.value = [cb.r, cb.g, cb.b];
          program.uniforms.uColorAccent.value = [cc.r, cc.g, cc.b];
          renderer?.render({ scene: mesh });
        }
      } catch (err) {
        console.warn("SilkBackground: 渲染失败", err);
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
  }, [colorA, colorB, colorAccent, speed, noiseScale, waveAmp, exposure, gamma, grainAmount, grainScale, shouldAnimate, zIndex, pointerEvents]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "fixed", inset: 0, zIndex, pointerEvents, ...style }}
      aria-hidden
    />
  );
}


