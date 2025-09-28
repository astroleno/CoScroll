'use client'

import { Suspense } from 'react'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { Loader } from '@/components/ui/Loader'
import { ContentProvider } from '@/contexts/ContentContext'
import DreamyLayout from '../layout/DreamyLayout'
import AudioController from './AudioController'
import ProgressBar from './ProgressBar'

// ScrollCanvas 主组件 - 使用新的三层布局架构
export default function ScrollCanvas() {
  return (
    <ErrorBoundary>
      <ContentProvider>
        <div className="relative w-full h-full">
          {/* 三层布局架构 */}
          <Suspense fallback={<Loader />}>
            <DreamyLayout />
          </Suspense>

          {/* UI 控制层组件 */}
          <AudioController />
          <ProgressBar />
        </div>
      </ContentProvider>
    </ErrorBoundary>
  )
}