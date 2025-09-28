'use client'

import { useState, useEffect, useCallback } from 'react'
import { Model3DInfo } from '@/types/model.types'
import { MVP_DATA } from '@/data/mvp-content'
import * as THREE from 'three'

// useModel Hook - 3D模型管理和状态
export function useModel() {
  const [currentModel, setCurrentModel] = useState<Model3DInfo | null>(null)
  const [currentModelPath, setCurrentModelPath] = useState<string>('/models/10k/003_道.glb')
  const [loadedModels, setLoadedModels] = useState<Map<string, THREE.Object3D>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 初始化默认模型
  useEffect(() => {
    const defaultModel = MVP_DATA.models['dao']
    setCurrentModel(defaultModel)
    setCurrentModelPath(defaultModel.filePath)
  }, [])

  // 根据锚字匹配模型
  const matchModelByAnchor = useCallback((anchorWord: string): Model3DInfo | null => {
    // 查找匹配的模型
    const modelEntry = Object.entries(MVP_DATA.models).find(([key, model]) =>
      key === anchorWord.toLowerCase() || model.name === anchorWord
    )

    if (modelEntry) {
      return modelEntry[1]
    }

    // 如果没找到匹配的，返回默认的道字模型
    return MVP_DATA.models['dao']
  }, [])

  // 切换到指定模型
  const switchToModel = useCallback((modelId: string) => {
    const model = MVP_DATA.models[modelId as keyof typeof MVP_DATA.models]
    if (model) {
      setCurrentModel(model)
      setCurrentModelPath(model.filePath)
    } else {
      console.warn(`Model not found: ${modelId}`)
    }
  }, [])

  // 根据锚字切换模型
  const switchByAnchor = useCallback((anchorWord: string) => {
    const matchedModel = matchModelByAnchor(anchorWord)
    if (matchedModel) {
      setCurrentModel(matchedModel)
      setCurrentModelPath(matchedModel.filePath)
    }
  }, [matchModelByAnchor])

  // 预加载模型
  const preloadModel = useCallback(async (modelId: string) => {
    if (loadedModels.has(modelId)) {
      return loadedModels.get(modelId)!
    }

    setIsLoading(true)
    try {
      // 这里应该使用 GLTFLoader 加载模型
      // 现在先返回一个占位符
      const model = new THREE.Object3D()
      model.name = modelId

      setLoadedModels(prev => new Map(prev).set(modelId, model))
      return model
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '模型加载失败'
      setError(errorMessage)
      console.error('Model preload error:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [loadedModels])

  // 获取模型列表
  const getModelList = useCallback((): Model3DInfo[] => {
    return Object.values(MVP_DATA.models)
  }, [])

  // 获取当前模型信息
  const getCurrentModelInfo = useCallback(() => {
    return {
      model: currentModel,
      path: currentModelPath,
      isLoaded: currentModel ? loadedModels.has(currentModel.id) : false,
      isLoading
    }
  }, [currentModel, currentModelPath, loadedModels, isLoading])

  // 清理已加载的模型
  const clearLoadedModels = useCallback(() => {
    // 清理Three.js对象
    loadedModels.forEach(model => {
      model.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material?.dispose())
          } else {
            child.material?.dispose()
          }
        }
      })
    })
    setLoadedModels(new Map())
  }, [loadedModels])

  // 获取模型统计信息
  const getModelStats = useCallback(() => {
    return {
      totalModels: Object.keys(MVP_DATA.models).length,
      loadedCount: loadedModels.size,
      currentModelId: currentModel?.id || null,
      availableModels: Object.keys(MVP_DATA.models)
    }
  }, [loadedModels.size, currentModel])

  return {
    // 当前状态
    currentModel,
    currentModelPath,
    isLoading,
    error,
    loadedModels,

    // 操作方法
    switchToModel,
    switchByAnchor,
    matchModelByAnchor,
    preloadModel,
    clearLoadedModels,

    // 信息获取
    getModelList,
    getCurrentModelInfo,
    getModelStats
  }
}