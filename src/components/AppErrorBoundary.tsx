import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  failed: boolean
}

export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('应用页面渲染失败', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="max-w-lg mx-auto min-h-svh px-6 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#F1F4E6] flex items-center justify-center text-2xl">🎾</div>
        <h1 className="mt-4 text-xl font-bold text-[#1A1A1A]">页面暂时无法显示</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
          训练数据仍保存在本地。重新加载后如果问题仍存在，可以先从设置页导出备份。
        </p>
        <div className="mt-5 flex gap-3">
          <a href="/" className="rounded-xl border border-[#E1E4D8] bg-white px-4 py-2.5 text-sm font-medium text-[#59633B]">
            返回首页
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-[#1A2E1A] px-4 py-2.5 text-sm font-semibold text-white"
          >
            重新加载
          </button>
        </div>
      </main>
    )
  }
}
