'use client'

import { useState, useEffect } from 'react'
import { ExperienceConfig, defaultConfig } from '@/config/experience.config'

// 配置加载hook
export function useExperienceConfig(configId?: string) {
  const [config, setConfig] = useState<ExperienceConfig>(defaultConfig)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (configId && configId !== defaultConfig.id) {
      setIsLoading(true)
      // 这里可以扩展为从API或其他配置文件加载
      // 目前直接使用默认配置
      setConfig(defaultConfig)
      setIsLoading(false)
    } else {
      setConfig(defaultConfig)
    }
  }, [configId])

  // 动态更新配置的方法
  const updateConfig = (updates: Partial<ExperienceConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  // 重置为默认配置
  const resetConfig = () => {
    setConfig(defaultConfig)
  }

  return {
    config,
    isLoading,
    error,
    updateConfig,
    resetConfig
  }
}