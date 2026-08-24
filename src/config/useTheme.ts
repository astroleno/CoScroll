/**
 * 主题 Hook
 *
 * 提供便捷的方式来使用和应用主题配置
 */

import { useEffect } from 'react';
import { useThemeConfig } from '@/stores/projectConfigStore';
import { themeInjector } from './themeInjector';

/**
 * 自动注入主题的 Hook
 *
 * 当主题配置变化时，自动注入到 CSS
 * 应该在根组件中使用
 *
 * @example
 * ```tsx
 * function App() {
 *   useTheme(); // 自动注入主题
 *   return <div>...</div>;
 * }
 * ```
 */
export function useTheme() {
  const theme = useThemeConfig();

  useEffect(() => {
    if (theme) {
      themeInjector.inject(theme);
    }
  }, [theme]);

  return theme;
}
