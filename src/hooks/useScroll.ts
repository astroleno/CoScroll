'use client'

import { useEffect, useState, useCallback } from 'react'
import { useScrollStore } from '@/stores/scrollStore'

// useScroll Hook - 滚动逻辑管理
export function useScroll() {
  const {
    scrollPosition,
    scrollSpeed,
    isScrolling,
    setScrollPosition,
    setScrollSpeed,
    setIsScrolling
  } = useScrollStore()

  const [lastScrollTime, setLastScrollTime] = useState(0)

  // 处理滚动事件
  const handleScroll = useCallback((event: WheelEvent | TouchEvent) => {
    event.preventDefault()

    const currentTime = Date.now()
    const deltaTime = currentTime - lastScrollTime
    setLastScrollTime(currentTime)

    let delta = 0

    // 处理不同类型的滚动事件
    if (event instanceof WheelEvent) {
      delta = event.deltaY
    } else if (event instanceof TouchEvent) {
      // 处理触摸滚动 (移动端)
      if (event.touches.length === 1) {
        const touch = event.touches[0]
        // 简单的触摸滚动处理，后续可优化
        delta = 0 // 需要计算触摸位移
      }
    }

    // 计算滚动速度 (像素/毫秒)
    const speed = deltaTime > 0 ? delta / deltaTime : 0

    // 更新滚动状态
    setScrollPosition(prev => prev + delta)
    setScrollSpeed(speed * 100) // 放大倍数以便于使用
    setIsScrolling(true)

    // 500ms 后清除滚动状态
    setTimeout(() => {
      setIsScrolling(false)
      setScrollSpeed(0)
    }, 500)
  }, [lastScrollTime, setScrollPosition, setScrollSpeed, setIsScrolling])

  // 注册滚动事件监听
  useEffect(() => {
    const element = document.body

    // 滚动事件选项
    const options: AddEventListenerOptions = {
      passive: false, // 允许 preventDefault
      capture: true
    }

    // 添加事件监听器
    element.addEventListener('wheel', handleScroll, options)
    element.addEventListener('touchmove', handleScroll, options)

    // 键盘事件支持
    const handleKeyPress = (event: KeyboardEvent) => {
      const delta = event.key === 'ArrowUp' ? -50 : event.key === 'ArrowDown' ? 50 : 0
      if (delta !== 0) {
        const wheelEvent = new WheelEvent('wheel', { deltaY: delta })
        handleScroll(wheelEvent)
      }
    }

    element.addEventListener('keydown', handleKeyPress)

    // 清理事件监听器
    return () => {
      element.removeEventListener('wheel', handleScroll, options)
      element.removeEventListener('touchmove', handleScroll, options)
      element.removeEventListener('keydown', handleKeyPress)
    }
  }, [handleScroll])

  // 重置滚动状态
  const resetScroll = useCallback(() => {
    setScrollPosition(0)
    setScrollSpeed(0)
    setIsScrolling(false)
  }, [setScrollPosition, setScrollSpeed, setIsScrolling])

  // 设置滚动位置 (用于程序控制)
  const setPosition = useCallback((position: number) => {
    setScrollPosition(position)
  }, [setScrollPosition])

  return {
    scrollPosition,
    scrollSpeed,
    isScrolling,
    resetScroll,
    setPosition
  }
}