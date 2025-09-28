'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ContentPackage } from '@/types/content.types'
import { contentManager, getDefaultContentId, preloadContents } from '@/utils/contentManager'

interface ContentContextType {
  currentContentId: string
  currentContent: ContentPackage | null
  isLoading: boolean
  error: string | null
  switchContent: (contentId: string) => Promise<void>
  availableContents: any[]
}

const ContentContext = createContext<ContentContextType | undefined>(undefined)

export function ContentProvider({ children }: { children: ReactNode }) {
  const [currentContentId, setCurrentContentId] = useState<string>(getDefaultContentId())
  const [currentContent, setCurrentContent] = useState<ContentPackage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 加载内容包
  const loadContent = async (contentId: string) => {
    try {
      setIsLoading(true)
      setError(null)
      console.log(`ContentContext: 开始加载内容包 ${contentId}`)

      const content = await contentManager.loadContent(contentId)
      setCurrentContent(content)
      setCurrentContentId(contentId)

      console.log(`ContentContext: 内容包加载成功 ${contentId}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误'
      setError(errorMessage)
      console.error(`ContentContext: 内容包加载失败 ${contentId}`, err)
    } finally {
      setIsLoading(false)
    }
  }

  // 切换内容包
  const switchContent = async (contentId: string) => {
    if (contentId !== currentContentId) {
      await loadContent(contentId)
    }
  }

  // 初始化加载默认内容
  useEffect(() => {
    const initializeContent = async () => {
      // 预加载内容
      await preloadContents()
      // 加载默认内容
      await loadContent(currentContentId)
    }

    initializeContent()
  }, [])

  const value: ContentContextType = {
    currentContentId,
    currentContent,
    isLoading,
    error,
    switchContent,
    availableContents: contentManager.getAvailableContents()
  }

  return (
    <ContentContext.Provider value={value}>
      {children}
    </ContentContext.Provider>
  )
}

// Hook to use content context
export function useContentContext() {
  const context = useContext(ContentContext)
  if (context === undefined) {
    throw new Error('useContentContext must be used within a ContentProvider')
  }
  return context
}

// Hook to get current content ID (with fallback)
export function useCurrentContentId() {
  const context = useContext(ContentContext)
  return context?.currentContentId || getDefaultContentId()
}