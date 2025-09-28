'use client'

import { useEffect, useState, useCallback } from 'react'
import { useContentStore } from '@/stores/contentStore'
import { TextSegment } from '@/types/content.types'
import { MVP_DATA } from '@/data/mvp-content'

// useText Hook - 文本数据和状态管理
export function useText() {
  const {
    currentIndex,
    segments,
    setCurrentIndex,
    setSegments
  } = useContentStore()

  const [isLoading, setIsLoading] = useState(true)

  // 初始化文本数据
  useEffect(() => {
    const loadTextData = async () => {
      try {
        // MVP 阶段使用硬编码数据
        const textData = MVP_DATA.heartSutra.segments
        setSegments(textData)
        setCurrentIndex(0)
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to load text data:', error)
        setIsLoading(false)
      }
    }

    loadTextData()
  }, [setSegments, setCurrentIndex])

  // 获取当前文本段落
  const currentText = segments[currentIndex] || null

  // 获取下一个文本段落 (循环)
  const nextText = segments[(currentIndex + 1) % segments.length] || null

  // 获取前一个文本段落 (循环)
  const prevText = segments[(currentIndex - 1 + segments.length) % segments.length] || null

  // 前进到下一个段落
  const nextSegment = useCallback(() => {
    setCurrentIndex((currentIndex + 1) % segments.length)
  }, [currentIndex, segments.length, setCurrentIndex])

  // 后退到前一个段落
  const prevSegment = useCallback(() => {
    setCurrentIndex((currentIndex - 1 + segments.length) % segments.length)
  }, [currentIndex, segments.length, setCurrentIndex])

  // 跳转到指定段落
  const goToSegment = useCallback((index: number) => {
    if (index >= 0 && index < segments.length) {
      setCurrentIndex(index)
    }
  }, [segments.length, setCurrentIndex])

  // 根据滚动位置更新当前段落
  const updateByScrollPosition = useCallback((scrollPosition: number) => {
    if (segments.length === 0) return

    // 简单的映射算法: 每 1000 像素滚动对应一个段落
    const segmentIndex = Math.floor(Math.abs(scrollPosition) / 1000) % segments.length
    if (segmentIndex !== currentIndex) {
      setCurrentIndex(segmentIndex)
    }
  }, [segments.length, currentIndex, setCurrentIndex])

  // 获取文本的元数据
  const getTextMetadata = useCallback(() => {
    return {
      totalSegments: segments.length,
      currentIndex,
      progress: segments.length > 0 ? (currentIndex / segments.length) * 100 : 0,
      currentAnchor: currentText?.anchorWord || '',
      nextAnchor: nextText?.anchorWord || ''
    }
  }, [segments.length, currentIndex, currentText, nextText])

  // 搜索包含特定关键词的段落
  const searchSegments = useCallback((keyword: string): TextSegment[] => {
    return segments.filter(segment =>
      segment.content.includes(keyword) ||
      segment.anchorWord?.includes(keyword)
    )
  }, [segments])

  return {
    // 基础数据
    currentText,
    nextText,
    prevText,
    segments,
    currentIndex,
    totalSegments: segments.length,
    isLoading,

    // 导航方法
    nextSegment,
    prevSegment,
    goToSegment,
    updateByScrollPosition,

    // 工具方法
    getTextMetadata,
    searchSegments
  }
}