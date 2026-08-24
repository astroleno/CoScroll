/**
 * 项目配置状态管理
 *
 * 使用 Zustand 管理项目配置的全局状态
 * 提供加载、更新、缓存等功能
 */

import { create } from 'zustand';
import type { ProjectConfig, ThemeConfig } from '@/config/types';
import { projectConfigLoader } from '@/config/loader';
import { DEFAULT_PROJECT_CONFIG } from '@/config/defaults';

interface ProjectConfigState {
  // ==================== 状态 ====================

  /** 当前加载的配置 */
  config: ProjectConfig | null;

  /** 当前项目 ID */
  currentProjectId: string | null;

  /** 加载状态 */
  isLoading: boolean;

  /** 错误信息 */
  error: string | null;

  // ==================== 操作 ====================

  /**
   * 加载项目配置
   */
  loadProject: (projectId: string) => Promise<void>;

  /**
   * 重新加载当前项目
   */
  reloadProject: () => Promise<void>;

  /**
   * 更新主题配置
   */
  updateTheme: (theme: Partial<ThemeConfig>) => void;

  /**
   * 更新配置（部分更新）
   */
  updateConfig: (updates: Partial<ProjectConfig>) => void;

  /**
   * 重置为默认配置
   */
  resetToDefault: () => void;

  /**
   * 清除错误
   */
  clearError: () => void;
}

/**
 * 项目配置 Store
 */
export const useProjectConfigStore = create<ProjectConfigState>((set, get) => ({
  // ==================== 初始状态 ====================

  config: null,
  currentProjectId: null,
  isLoading: false,
  error: null,

  // ==================== 操作实现 ====================

  /**
   * 加载项目配置
   */
  loadProject: async (projectId: string) => {
    const { currentProjectId } = get();

    // 如果已经加载了相同的项目，跳过
    if (currentProjectId === projectId && get().config !== null) {
      console.log(`[ProjectConfigStore] 项目 ${projectId} 已加载，跳过`);
      return;
    }

    console.log(`[ProjectConfigStore] 🚀 开始加载项目: ${projectId}`);
    set({ isLoading: true, error: null });

    try {
      console.log(`[ProjectConfigStore] 📡 调用 projectConfigLoader.load...`);

      const config = await projectConfigLoader.load(projectId, {
        useCache: true,
        fallbackToDefault: true,
      });

      set({
        config,
        currentProjectId: projectId,
        isLoading: false,
        error: null,
      });

      console.log(`[ProjectConfigStore] ✅ 项目加载成功: ${projectId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '未知错误';

      console.error(`[ProjectConfigStore] ❌ 加载失败:`, error);

      set({
        config: null,
        currentProjectId: null,
        isLoading: false,
        error: errorMessage,
      });
    }
  },

  /**
   * 重新加载当前项目
   */
  reloadProject: async () => {
    const { currentProjectId } = get();

    if (!currentProjectId) {
      console.warn('[ProjectConfigStore] 没有当前项目，无法重新加载');
      return;
    }

    // 清除缓存并重新加载
    projectConfigLoader.clearCache(currentProjectId);
    await get().loadProject(currentProjectId);
  },

  /**
   * 更新主题配置
   */
  updateTheme: (themeUpdates: Partial<ThemeConfig>) => {
    const { config } = get();

    if (!config) {
      console.warn('[ProjectConfigStore] 没有配置，无法更新主题');
      return;
    }

    set({
      config: {
        ...config,
        theme: {
          ...config.theme,
          ...themeUpdates,
          // 深度合并嵌套对象
          anchor: {
            ...config.theme.anchor,
            ...(themeUpdates.anchor || {}),
          },
          lyrics: {
            ...config.theme.lyrics,
            ...(themeUpdates.lyrics || {}),
          },
          progressBar: {
            ...config.theme.progressBar,
            ...(themeUpdates.progressBar || {}),
          },
          background: {
            ...config.theme.background,
            ...(themeUpdates.background || {}),
          },
        },
      },
    });

    console.log('[ProjectConfigStore] 主题已更新', themeUpdates);
  },

  /**
   * 更新配置（部分更新）
   */
  updateConfig: (updates: Partial<ProjectConfig>) => {
    const { config } = get();

    if (!config) {
      console.warn('[ProjectConfigStore] 没有配置，无法更新');
      return;
    }

    set({
      config: {
        ...config,
        ...updates,
      },
    });

    console.log('[ProjectConfigStore] 配置已更新', updates);
  },

  /**
   * 重置为默认配置
   */
  resetToDefault: () => {
    const defaultConfig = JSON.parse(
      JSON.stringify(DEFAULT_PROJECT_CONFIG)
    ) as ProjectConfig;

    set({
      config: defaultConfig,
      currentProjectId: 'default',
      isLoading: false,
      error: null,
    });

    console.log('[ProjectConfigStore] 已重置为默认配置');
  },

  /**
   * 清除错误
   */
  clearError: () => {
    set({ error: null });
  },
}));

// ==================== Hooks ====================

/**
 * 获取当前配置
 */
export function useCurrentConfig() {
  return useProjectConfigStore((state) => state.config);
}

/**
 * 获取主题配置
 */
export function useThemeConfig() {
  return useProjectConfigStore((state) => state.config?.theme);
}

/**
 * 获取资源配置
 */
export function useAssetConfig() {
  return useProjectConfigStore((state) => state.config?.assets);
}
