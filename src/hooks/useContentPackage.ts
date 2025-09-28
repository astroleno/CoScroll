'use client'

import { useState, useEffect } from 'react'
import { ContentPackage, ContentLoadState } from '@/types/content.types'
import { contentManager, getDefaultContentId } from '@/utils/contentManager'
import { useCurrentContentId } from '@/contexts/ContentContext'

// 内容包加载Hook
export function useContentPackage(contentId?: string) {
  const contextContentId = useCurrentContentId()
  const [loadState, setLoadState] = useState<ContentLoadState>({
    isLoading: true,
    isLoaded: false,
    error: null,
    package: null
  })

  const targetContentId = contentId || contextContentId

  useEffect(() => {
    let mounted = true

    const loadContent = async () => {
      try {
        setLoadState(prev => ({
          ...prev,
          isLoading: true,
          error: null
        }))

        console.log(`useContentPackage: 开始加载内容包 ${targetContentId}`)

        const contentPackage = await contentManager.loadContent(targetContentId)

        if (mounted) {
          setLoadState({
            isLoading: false,
            isLoaded: true,
            error: null,
            package: contentPackage
          })
          console.log(`useContentPackage: 内容包加载成功 ${targetContentId}`)
        }

      } catch (error) {
        if (mounted) {
          const errorMessage = error instanceof Error ? error.message : '未知错误'
          setLoadState({
            isLoading: false,
            isLoaded: false,
            error: errorMessage,
            package: null
          })
          console.error(`useContentPackage: 内容包加载失败 ${targetContentId}`, error)
        }
      }
    }

    loadContent()

    return () => {
      mounted = false
    }
  }, [targetContentId])

  // 重新加载内容包
  const reload = async () => {
    contentManager.clearCache()
    setLoadState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }))
  }

  return {
    ...loadState,
    contentId: targetContentId,
    reload
  }
}

// 内容包音频配置Hook - 替换useExperienceConfig
export function useContentAudio(contentId?: string) {
  const { package: contentPackage, isLoading, error } = useContentPackage(contentId)

  const audioConfig = contentPackage?.audio || {
    file: '',
    loopEndTime: 0,
    fadeOutDuration: 0,
    volume: 1.0
  }

  const lyricsConfig = contentPackage?.lyrics || {
    file: '',
    encoding: 'utf-8'
  }

  return {
    audio: audioConfig,
    lyrics: lyricsConfig,
    isLoading,
    error,
    // 保持与原useExperienceConfig的兼容性
    config: {
      audio: audioConfig,
      lyrics: lyricsConfig
    }
  }
}

// 内容包段落数据Hook - 替换heartSutra.ts的直接导入
export function useContentSegments(contentId?: string) {
  const { package: contentPackage, isLoading, error } = useContentPackage(contentId)

  const segments = contentPackage?.segments || []

  // 获取当前活跃段落 - 保持与原系统兼容
  const getCurrentSegment = (scrollProgress: number) => {
    if (segments.length === 0) return null
    const index = Math.floor(scrollProgress * segments.length)
    return segments[Math.min(index, segments.length - 1)]
  }

  return {
    segments,
    getCurrentSegment,
    isLoading,
    error,
    // 保持与原系统兼容
    heartSutraSegments: segments
  }
}

// 内容包视觉配置Hook
export function useContentVisuals(contentId?: string) {
  const { package: contentPackage, isLoading, error } = useContentPackage(contentId)

  const visualsConfig = contentPackage?.visuals || {
    model: '',
    fallbackColor: '#ff0000',
    rotationSpeed: 1.0,
    backgroundStyle: 'default' as const
  }

  return {
    visuals: visualsConfig,
    isLoading,
    error
  }
}

// 内容包交互配置Hook
export function useContentInteraction(contentId?: string) {
  const { package: contentPackage, isLoading, error } = useContentPackage(contentId)

  const interactionConfig = contentPackage?.interaction || {
    scrollSensitivity: 0.01,
    speedRange: [0.2, 3.0] as [number, number],
    controlMode: 'scroll' as const
  }

  return {
    interaction: interactionConfig,
    isLoading,
    error
  }
}

// 内容包元数据Hook
export function useContentMetadata(contentId?: string) {
  const { package: contentPackage, isLoading, error } = useContentPackage(contentId)

  const metadata = contentPackage?.meta || {
    id: '',
    title: '',
    description: '',
    category: 'custom' as const,
    difficulty: 'beginner' as const,
    duration: '0:00',
    tags: [],
    version: '1.0.0'
  }

  return {
    metadata,
    isLoading,
    error
  }
}