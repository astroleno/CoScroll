/**
 * 配置加载器
 *
 * 负责从外部 JSON 文件加载配置，验证格式，并提供缓存
 */

import type { ProjectConfig } from './types';
import { safeValidateProjectConfig } from './schema';
import { DEFAULT_PROJECT_CONFIG } from './defaults';
import { assetUrl } from '@/utils/assetUrl';
import { readEntryProject } from './entryBootstrap';

/**
 * 配置加载器类
 * 使用单例模式，确保全局只有一个实例
 */
class ProjectConfigLoader {
  private cache = new Map<string, ProjectConfig>();
  private loadingPromises = new Map<string, Promise<ProjectConfig>>();

  /**
   * 加载项目配置
   *
   * @param projectId - 项目 ID（对应 /public/projects/{projectId}.json）
   * @param options - 加载选项
   * @returns 验证后的配置对象
   */
  async load(
    projectId: string,
    options: {
      useCache?: boolean;
      fallbackToDefault?: boolean;
      signal?: AbortSignal;
    } = {}
  ): Promise<ProjectConfig> {
    const { useCache = true, fallbackToDefault = true, signal } = options;
    signal?.throwIfAborted();

    // 1. 检查缓存
    if (useCache && this.cache.has(projectId)) {
      console.log(`[ConfigLoader] 从缓存加载配置: ${projectId}`);
      return this.cache.get(projectId)!;
    }

    // 2. 检查是否正在加载（避免重复请求）
    if (!signal && this.loadingPromises.has(projectId)) {
      console.log(`[ConfigLoader] 等待现有加载: ${projectId}`);
      return this.loadingPromises.get(projectId)!;
    }

    // 3. 开始加载
    const loadPromise = this._loadAndValidate(projectId, fallbackToDefault, signal, useCache);
    if (!signal) this.loadingPromises.set(projectId, loadPromise);

    try {
      const config = await loadPromise;
      signal?.throwIfAborted();
      // 加载成功，缓存结果
      if (config.project.id === projectId) this.cache.set(projectId, config);
      return config;
    } finally {
      // 清理加载 Promise
      if (this.loadingPromises.get(projectId) === loadPromise) this.loadingPromises.delete(projectId);
    }
  }

  /**
   * 内部加载和验证逻辑
   */
  private async _loadAndValidate(
    projectId: string,
    fallbackToDefault: boolean,
    signal?: AbortSignal,
    useEntry = true,
  ): Promise<ProjectConfig> {
    try {
      console.log(`[ConfigLoader] 加载配置文件: /projects/${projectId}.json`);

      // 加载 JSON 文件
      const entry = useEntry ? readEntryProject(projectId) : null;
      const validatedEntry = entry && safeValidateProjectConfig(entry.config);
      let data;
      if (validatedEntry?.success) data = validatedEntry.data;
      else {
        const response = await fetch(assetUrl(`/projects/${projectId}.json`), {signal});

        if (!response.ok) {
          throw new Error(`配置文件加载失败: ${response.status} ${response.statusText}`);
        }

        data = await response.json();
      }

      // Zod 验证
      const result = safeValidateProjectConfig(data);

      if (!result.success) {
        console.error(
          `[ConfigLoader] 配置验证失败:`,
          result.error?.format()
        );
        throw new Error(
          `配置格式错误: ${result.error?.issues.map((e) => e.message).join(', ')}`
        );
      }

      if (result.data!.project.id !== projectId) throw new Error('曲目配置 ID 与请求不一致');
      return result.data!;
    } catch (error) {
      if (signal?.aborted) throw error;
      console.error(`[ConfigLoader] ❌ 加载配置失败:`, error);

      if (fallbackToDefault) {
        console.warn(`[ConfigLoader] 使用默认配置`);
        return this._getDefaultConfig();
      }

      throw error;
    }
  }

  /**
   * 获取默认配置的深拷贝
   */
  private _getDefaultConfig(): ProjectConfig {
    return JSON.parse(JSON.stringify(DEFAULT_PROJECT_CONFIG));
  }

  /**
   * 清除缓存
   */
  clearCache(projectId?: string): void {
    if (projectId) {
      this.cache.delete(projectId);
      console.log(`[ConfigLoader] 清除缓存: ${projectId}`);
    } else {
      this.cache.clear();
      console.log(`[ConfigLoader] 清除所有缓存`);
    }
  }
}

/**
 * 单例实例
 * 全局共享同一个加载器，确保缓存一致性
 */
export const projectConfigLoader = new ProjectConfigLoader();
