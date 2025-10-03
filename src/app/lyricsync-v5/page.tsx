'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// 动态导入以避免 SSR 问题（音频和动画需要客户端环境）
const LyricsSyncV5 = dynamic(() => import('@/components/LyricSync-v4'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 50%, #f093fb15 100%)'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40,
          height: 40,
          border: '4px solid #e5e5e5',
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px'
        }} />
        <p style={{ color: '#666', fontSize: 16 }}>正在加载 LyricSync-v5...</p>
      </div>
    </div>
  )
})

export default function LyricsSyncV5Page() {
  return (
    <Suspense fallback={
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 50%, #f093fb15 100%)'
      }}>
        <p style={{ color: '#666', fontSize: 16 }}>初始化中...</p>
      </div>
    }>
      <LyricsSyncV5 />
    </Suspense>
  )
}

// 添加所有必要的动画样式
const style = document.createElement('style')
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.9; }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  @keyframes glow {
    0%, 100% { box-shadow: 0 0 20px rgba(255,107,53,0.3); }
    50% { box-shadow: 0 0 40px rgba(255,107,53,0.6); }
  }

  /* 防止页面滚动的全局样式 */
  body, html {
    overflow: hidden !important;
    touch-action: none !important;
  }
`
if (typeof document !== 'undefined') {
  document.head.appendChild(style)
}