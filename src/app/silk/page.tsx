"use client";

import React from "react";
import dynamic from "next/dynamic";

const SilkR3F = dynamic(() => import("@/components/backgrounds/SilkR3F"), { ssr: false });

/**
 * /silk 预览页
 * - 使用 SilkBackground，作为独立路由方便集成与调参。
 * - 页面主体仅放置示例文案层，真实项目中可替换为歌词/模型等内容。
 */
export default function SilkPreviewPage(){
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        background: "#0f1220", // 深色底，保证与丝绸颜色有对比
      }}
    >
      <SilkR3F
        // 统一使用 R3F 版本（主线参数）
        speed={4.9}
        scale={1}
        noiseIntensity={1.3}
        rotation={2.42}
        color="1f2e38"
      />

      <section
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          color: "#e9ecf1",
          textShadow: "0 2px 14px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ maxWidth: 720, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 12 }}>Silk 背景预览</h1>
          <p style={{ lineHeight: 1.6 }}>
            丝绸流动背景，取色自 A/B 渐变并融合强调色，高光柔和；该页强制开启动画以便观感校验。
          </p>
        </div>
      </section>
    </main>
  );
}


