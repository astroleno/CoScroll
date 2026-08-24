/**
 * 动态主题注入器
 *
 * 负责将配置中的颜色动态注入到 CSS 中
 * 包括 CSS 变量和动画关键帧
 */

import type { ThemeConfig } from './types';

/**
 * 主题注入器类
 */
class ThemeInjector {
  private animationStyleElement: HTMLStyleElement | null = null;

  /**
   * 注入主题（包括 CSS 变量和动画）
   */
  inject(theme: ThemeConfig): void {
    if (typeof document === 'undefined') return;

    this.injectCSSVariables(theme);
    this.injectAnimations(theme);

    console.log('[ThemeInjector] 主题已注入');
  }

  /**
   * 注入 CSS 变量
   */
  private injectCSSVariables(theme: ThemeConfig): void {
    const root = document.documentElement;

    // 锚字颜色
    root.style.setProperty('--anchor-primary', theme.anchor.primary);
    root.style.setProperty('--anchor-glow-primary', theme.anchor.glowPrimary);
    root.style.setProperty(
      '--anchor-glow-secondary',
      theme.anchor.glowSecondary
    );
    root.style.setProperty(
      '--anchor-glow-intensity',
      theme.anchor.glowIntensity.toString()
    );

    // 歌词颜色
    root.style.setProperty('--lyrics-current', theme.lyrics.current);
    root.style.setProperty('--lyrics-adjacent', theme.lyrics.adjacent);
    root.style.setProperty('--lyrics-next-adjacent', theme.lyrics.nextAdjacent);
    root.style.setProperty('--lyrics-distant', theme.lyrics.distant);
    root.style.setProperty(
      '--lyrics-gradient-start',
      theme.lyrics.gradientStart
    );
    root.style.setProperty('--lyrics-gradient-end', theme.lyrics.gradientEnd);
    if (theme.lyrics.hoverBackground) {
      root.style.setProperty(
        '--lyrics-hover-bg',
        theme.lyrics.hoverBackground
      );
    }

    // 进度条颜色
    root.style.setProperty(
      '--progressbar-background',
      theme.progressBar.background
    );
    root.style.setProperty(
      '--progressbar-completed',
      theme.progressBar.completed
    );
    root.style.setProperty('--progressbar-slider', theme.progressBar.slider);
    root.style.setProperty('--progressbar-border', theme.progressBar.border);

    // 背景颜色
    root.style.setProperty('--background-base', theme.background.base);
    root.style.setProperty('--background-overlay', theme.background.overlay);
  }

  /**
   * 注入动画关键帧
   */
  private injectAnimations(theme: ThemeConfig): void {
    // 移除旧的动画样式
    if (this.animationStyleElement) {
      this.animationStyleElement.remove();
    }

    // 创建新的样式元素
    this.animationStyleElement = document.createElement('style');
    this.animationStyleElement.id = 'theme-animations';
    this.animationStyleElement.textContent = this.generateAnimationCSS(theme);

    document.head.appendChild(this.animationStyleElement);
  }

  /**
   * 生成动画 CSS
   */
  private generateAnimationCSS(theme: ThemeConfig): string {
    return `
      /* 锚字呼吸动画 */
      @keyframes anchor-breath {
        0%, 100% {
          transform: scale(1);
          text-shadow:
            0 0 25px ${theme.anchor.glowPrimary},
            0 0 60px ${theme.anchor.glowSecondary};
        }
        50% {
          transform: scale(1.02);
          text-shadow:
            0 0 30px ${theme.anchor.glowPrimary},
            0 0 70px ${theme.anchor.glowSecondary};
        }
      }

      /* 锚字颜色变化动画 */
      @keyframes anchor-color-shift {
        0% {
          text-shadow:
            0 0 25px ${theme.anchor.glowPrimary},
            0 0 60px ${theme.anchor.glowSecondary};
        }
        50% {
          text-shadow:
            0 0 30px ${theme.anchor.glowSecondary},
            0 0 70px ${theme.anchor.glowPrimary};
        }
        100% {
          text-shadow:
            0 0 25px ${theme.anchor.glowPrimary},
            0 0 60px ${theme.anchor.glowSecondary};
        }
      }

      /* 歌词淡入动画 */
      @keyframes lyrics-fade-in {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
  }
}

/**
 * 全局单例
 */
export const themeInjector = new ThemeInjector();
