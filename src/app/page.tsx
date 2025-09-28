import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-paper-light to-paper-dark flex items-center justify-center">
      <div className="text-center space-y-8 p-8">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold text-ink-dark font-chinese">
            CoScroll
          </h1>
          <p className="text-xl text-ink-light font-chinese">
            数字经卷体验
          </p>
          <p className="text-base text-ink opacity-70 max-w-md mx-auto">
            通过滚动交互，体验 3D 书法模型与音频同步的沉浸式经文阅读
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/experience"
            className="inline-block bg-ink text-paper-light px-8 py-3 rounded-lg hover:bg-ink-light transition-colors font-chinese"
          >
            开始体验
          </Link>

          <div className="text-sm text-ink opacity-50">
            MVP 版本 - 心经体验
          </div>
        </div>

        <div className="text-xs text-ink opacity-30 space-y-2">
          <p>技术栈: Next.js + Three.js + React Three Fiber</p>
          <p>现有模型: 道 (003_道.glb)</p>
        </div>
      </div>
    </main>
  )
}