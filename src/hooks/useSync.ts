'use client'

import { useEffect, useCallback } from 'react'
import { useScroll } from './useScroll'
import { useText } from './useText'
import { useModel } from './useModel'

// useSync Hook - 同步滚动、文字、模型的核心逻辑
export function useSync() {
  const { scrollPosition, scrollSpeed } = useScroll()
  const { updateByScrollPosition, currentText } = useText()
  const { switchByAnchor } = useModel()

  // 滚动位置变化时的同步处理
  useEffect(() => {
    // 根据滚动位置更新文本段落
    updateByScrollPosition(scrollPosition)
  }, [scrollPosition, updateByScrollPosition])

  // 当前文本变化时切换模型
  useEffect(() => {
    if (currentText?.anchorWord) {
      switchByAnchor(currentText.anchorWord)
    }
  }, [currentText, switchByAnchor])

  // 计算同步后的旋转速度
  const getRotationSpeed = useCallback((baseSpeed: number = 0.01) => {
    const normalizedScrollSpeed = Math.abs(scrollSpeed) / 100
    return normalizedScrollSpeed * baseSpeed
  }, [scrollSpeed])

  // 计算同步后的音频播放倍速
  const getPlaybackRate = useCallback(() => {
    const baseRate = 1.0
    const speedFactor = scrollSpeed / 100
    // 限制在合理范围内
    return Math.max(0.5, Math.min(2.0, baseRate + speedFactor))
  }, [scrollSpeed])

  // 获取文字动画参数
  const getTextAnimationParams = useCallback(() => {
    const offset = scrollPosition * 0.01
    const speed = Math.abs(scrollSpeed) * 0.001

    return {
      frontTextY: 2 + offset,
      backTextY: -2 - offset,
      frontOpacity: Math.max(0.3, 1 - speed),
      backOpacity: Math.max(0.2, 0.6 - speed * 0.5)
    }
  }, [scrollPosition, scrollSpeed])

  // 获取模型动画参数
  const getModelAnimationParams = useCallback(() => {
    const rotationSpeed = getRotationSpeed()
    const floatAmplitude = 0.1
    const floatSpeed = 0.5

    return {
      rotationSpeed,
      floatAmplitude,
      floatSpeed,
      scale: 1 + Math.abs(scrollSpeed) * 0.001 // 根据滚动速度轻微缩放
    }
  }, [scrollSpeed, getRotationSpeed])

  // 获取完整的同步状态
  const getSyncState = useCallback(() => {
    return {
      scrollPosition,
      scrollSpeed,
      currentSegment: currentText,
      rotationSpeed: getRotationSpeed(),
      playbackRate: getPlaybackRate(),
      textAnimation: getTextAnimationParams(),
      modelAnimation: getModelAnimationParams()
    }
  }, [
    scrollPosition,
    scrollSpeed,
    currentText,
    getRotationSpeed,
    getPlaybackRate,
    getTextAnimationParams,
    getModelAnimationParams
  ])

  // 检查同步状态是否正常
  const isSyncHealthy = useCallback(() => {
    return {
      scrollResponsive: Math.abs(scrollSpeed) > 0 || scrollPosition !== 0,
      textLoaded: !!currentText,
      parametersValid: !isNaN(getPlaybackRate()) && !isNaN(getRotationSpeed())
    }
  }, [scrollSpeed, scrollPosition, currentText, getPlaybackRate, getRotationSpeed])

  return {
    // 计算方法
    getRotationSpeed,
    getPlaybackRate,
    getTextAnimationParams,
    getModelAnimationParams,
    getSyncState,

    // 状态检查
    isSyncHealthy,

    // 快捷访问当前同步参数
    rotationSpeed: getRotationSpeed(),
    playbackRate: getPlaybackRate(),
    textAnimation: getTextAnimationParams(),
    modelAnimation: getModelAnimationParams()
  }
}