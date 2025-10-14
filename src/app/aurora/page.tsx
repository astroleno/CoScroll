"use client";

import React from "react";
import AuroraBackground from "@/components/backgrounds/AuroraBackground";

/**
 * /aurora 预览页（CSS 版本，增强动画可见性）
 * - 使用 `AuroraBackground`，通过 CSS 变量驱动渐变中心流动，避免外部依赖。
 * - 独立路由，不影响主页。
 */
export default function AuroraPreviewPage() {
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        background: "transparent",
      }}
    >
      {/* 背景层：仅使用正式组件 AuroraBackground（OGL 版封装） */}
      <AuroraBackground
        color1="#194f67"
        color2="#3c315e"
        color3="#3e4e8e"
        amplitude={1.2}
        blend={0.6}
        speed={1.0}
        noiseScale={1.2}
        colorJitter={0.2}
        dualBands
        useSketchStyle
        exposure={0.7}
        gamma={1.25}
        centerVignette={0.7}
        highlightClamp={0.8}
        animate
        forceAnimation
        mobileOptimize={false}
        zIndex={0}
        style={{ mixBlendMode: "screen" }}
      />

      {/* 文案层：置于上方 */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          color: "#e6e6f0",
          textShadow: "0 2px 14px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ maxWidth: 720, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 12 }}>Aurora 背景预览</h1>
          <p style={{ lineHeight: 1.6 }}>当前颜色：#194f67（主） / #3c315e（次） / #3e4e8e（强调）。此页使用 OGL 封装版 AuroraBackground，已强制开启动画。</p>
        </div>
      </section>
    </main>
  );
}


