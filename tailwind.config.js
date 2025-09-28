/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // CoScroll 主题色彩
        primary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          500: '#64748b',
          900: '#0f172a',
        },
        // 古典色彩
        ink: {
          light: '#374151',
          DEFAULT: '#1f2937',
          dark: '#111827',
        },
        paper: {
          light: '#fefefe',
          DEFAULT: '#f9fafb',
          dark: '#f3f4f6',
        }
      },
      fontFamily: {
        // 中文字体
        chinese: ['PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
        // 英文字体
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'scroll-slow': 'scroll 20s linear infinite',
        'rotate-slow': 'rotate 30s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
      },
      keyframes: {
        scroll: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(-100%)' },
        },
        rotate: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      }
    },
  },
  plugins: [],
}