'use client'

interface LoaderProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

// Loader 组件 - 加载指示器
export function Loader({ message = '加载中...', size = 'md' }: LoaderProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-16 h-16'
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-paper-dark/80 backdrop-blur-sm z-50">
      <div className="text-center space-y-4">
        {/* 旋转加载器 */}
        <div className="relative mx-auto">
          <div className={`${sizeClasses[size]} border-4 border-ink/20 rounded-full animate-spin border-t-ink`} />
        </div>

        {/* 加载文字 */}
        <p className="text-ink-light font-chinese text-sm">
          {message}
        </p>

        {/* 简单的进度指示 */}
        <div className="w-32 h-1 bg-ink/10 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-ink rounded-full animate-pulse" style={{
            animation: 'loading 2s ease-in-out infinite'
          }} />
        </div>
      </div>

      <style jsx>{`
        @keyframes loading {
          0% { width: 0%; }
          50% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>
    </div>
  )
}

// 内联加载器 - 用于组件内部
export function InlineLoader({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6'
  }

  return (
    <div className="inline-flex items-center space-x-2">
      <div className={`${sizeClasses[size]} border-2 border-ink/20 rounded-full animate-spin border-t-ink`} />
      <span className="text-ink-light text-sm">加载中</span>
    </div>
  )
}