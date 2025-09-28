'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

// ErrorBoundary 组件 - 捕获和处理组件错误
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-paper-dark">
          <div className="text-center space-y-4 p-8 bg-paper-light rounded-lg max-w-md">
            <div className="text-red-500">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.732 6.5c-.77.833-.192 2.5 1.732 2.5z" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-ink-dark font-chinese">
              渲染出错
            </h2>

            <p className="text-ink-light text-sm">
              {this.state.error?.message || '发生了未知错误'}
            </p>

            <button
              onClick={() => {
                this.setState({ hasError: false, error: undefined })
                window.location.reload()
              }}
              className="bg-ink text-paper-light px-4 py-2 rounded-lg hover:bg-ink-light transition-colors"
            >
              重新加载
            </button>

            <div className="text-xs text-ink/50">
              请确保浏览器支持 WebGL 2.0
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}