import type { ReactNode } from 'react'
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
    <div className="flex h-screen w-full overflow-hidden" style={{ backgroundColor: bg }}>
      <Sidebar active={active} role={state.role} onNavigate={onNavigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
