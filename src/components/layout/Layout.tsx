import type { ReactNode } from 'react'
import { PanelLeft } from 'lucide-react'
import Sidebar, { type PageKey } from './Sidebar'
import Header from './Header'
import { useStore } from '@/store'
import { useThemeBg } from '@/lib/theme'

export default function Layout({
  active,
  title,
  onNavigate,
  children,
}: {
  active: PageKey
  title: string
  onNavigate: (key: PageKey) => void
  children: ReactNode
}) {
  const { state } = useStore()
  const { bg } = useThemeBg()

  return (
    /* 全局布局：顶栏通栏在最上方（全宽，底边分隔线横贯），左侧导航从分隔线下方开始 + 右侧内容区 */
    <div className="flex h-screen w-full flex-col overflow-hidden" style={{ backgroundColor: bg }}>
      <Header />
      <div className="flex min-h-0 flex-1">
        {/* 左侧悬浮圆角导航卡片：外层容器提供上/左/下留白（12px），卡片右侧间距由内容区 p-6 提供 */}
        <div className="flex shrink-0 py-3 pl-3">
          <Sidebar active={active} role={state.role} onNavigate={onNavigate} />
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-[1440px]">
            {/* 页标题行（原在顶栏，R11 迁入内容区顶部）：小图标 + 页英文名（大写） */}
            <div className="mb-5 flex items-center gap-2">
              <PanelLeft className="h-[18px] w-[18px] text-gray-400" />
              <h1 className="text-lg font-semibold tracking-wide text-gray-700">{title}</h1>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
