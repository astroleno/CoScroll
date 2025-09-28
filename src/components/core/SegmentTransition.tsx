'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

// 段落切换动画组件
interface SegmentTransitionProps {
  currentAnchor: string
  isTransitioning: boolean
  children: React.ReactNode
}

export default function SegmentTransition({
  currentAnchor,
  isTransitioning,
  children
}: SegmentTransitionProps) {
  const [displayAnchor, setDisplayAnchor] = useState(currentAnchor)

  // 当锚字改变时更新显示
  useEffect(() => {
    if (!isTransitioning) {
      setDisplayAnchor(currentAnchor)
    }
  }, [currentAnchor, isTransitioning])

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* 3D模型容器 - 始终显示，不参与文字动画 */}
      <div className="absolute inset-0">
        {children}
      </div>

      {/* 锚字动画层 */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={displayAnchor}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              duration: 0.6
            }}
            className="text-6xl font-chinese font-bold text-white/80 z-10"
          >
            {displayAnchor}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 切换状态指示器 */}
      {isTransitioning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute top-4 right-4 text-white/50 text-sm z-20"
        >
          切换中...
        </motion.div>
      )}
    </div>
  )
}