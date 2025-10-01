'use client';

import { useState } from 'react';
import MochiSphere from '@/components/mochi/MochiSphere';
import MochiSphereV3 from '@/components/mochi/MochiSphereV3';

export default function MochiComparePage() {
  const [version, setVersion] = useState<'v2' | 'v3'>('v3');

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* 版本切换按钮 */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '12px 24px',
          borderRadius: '30px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          gap: '12px',
          fontFamily: 'system-ui, sans-serif'
        }}
      >
        <button
          onClick={() => setVersion('v2')}
          style={{
            padding: '8px 20px',
            borderRadius: '20px',
            border: 'none',
            background: version === 'v2' ? '#5e72e4' : '#e9ecef',
            color: version === 'v2' ? 'white' : '#495057',
            fontWeight: version === 'v2' ? 'bold' : 'normal',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          V2 (onBeforeCompile)
        </button>
        <button
          onClick={() => setVersion('v3')}
          style={{
            padding: '8px 20px',
            borderRadius: '20px',
            border: 'none',
            background: version === 'v3' ? '#5e72e4' : '#e9ecef',
            color: version === 'v3' ? 'white' : '#495057',
            fontWeight: version === 'v3' ? 'bold' : 'normal',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          V3 (Full Shader) ✨
        </button>
      </div>

      {/* 版本说明 */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '12px',
          fontSize: '14px',
          maxWidth: '600px',
          textAlign: 'center'
        }}
      >
        {version === 'v2' ? (
          <div>
            <strong>V2</strong>: 冷暖渐变 + 多色外壳 + 细微噪声
            <br />
            <span style={{ fontSize: '12px', opacity: 0.8 }}>
              使用 onBeforeCompile 注入 shader
            </span>
          </div>
        ) : (
          <div>
            <strong>V3</strong>: 4色HSV渐变（蓝→粉→橙→黄）+ 强化Fresnel + Dither颗粒感
            <br />
            <span style={{ fontSize: '12px', opacity: 0.8 }}>
              完整 ShaderMaterial，球坐标多层混合，表面细腻噪声
            </span>
          </div>
        )}
      </div>

      {/* 渲染对应版本 */}
      {version === 'v2' ? (
        <MochiSphere theme="pastel" autoRotate rotationSpeed={0.2} />
      ) : (
        <MochiSphereV3 autoRotate rotationSpeed={0.2} />
      )}
    </div>
  );
}
