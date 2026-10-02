import { Home, FolderUp, FolderSync, FolderSearch, FolderOpen, FolderArchive, Heart, LayoutDashboard, UsersRound, Building2, Braces, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeBg } from '@/lib/theme'
import type { Role } from '@/store'

export type PageKey =
  | 'home'
  | 'submission'
  | 'transfer'
  | 'review'
  | 'study'
  | 'site'
  | 'favorite'
  | 'dashboard'
  | 'accounts'
  | 'customers'
  | 'naming'
  | 'audit'

const allNavItems: { key: PageKey; label: string; icon: typeof Home; roles: Role[] }[] = [
  { key: 'home', label: 'Home', icon: Home, roles: ['pm', 'executor'] },
  { key: 'submission', label: 'SUBMISSION', icon: FolderUp, roles: ['pm', 'executor'] },
  { key: 'transfer', label: 'Transfer', icon: FolderSync, roles: ['pm', 'executor'] },
  { key: 'review', label: 'REVIEW', icon: FolderSearch, roles: ['pm'] },
  { key: 'study', label: 'STUDY TMF', icon: FolderOpen, roles: ['pm'] },
  { key: 'site', label: 'SITE TMF', icon: FolderArchive, roles: ['pm', 'executor'] },
  { key: 'favorite', label: 'Favorite', icon: Heart, roles: ['pm', 'executor'] },
  { key: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard, roles: ['admin'] },
  { key: 'accounts', label: 'ACCOUNTS', icon: UsersRound, roles: ['admin'] },
  { key: 'customers', label: 'CUSTOMERS', icon: Building2, roles: ['admin'] },
  { key: 'naming', label: 'NAMING', icon: Braces, roles: ['admin'] },
  { key: 'audit', label: 'AUDIT', icon: History, roles: ['admin'] },
]

/** 各角色的默认首页 */
export function homeOf(role: Role): PageKey {
  return role === 'admin' ? 'dashboard' : 'home'
}

export function pagesForRole(role: Role): PageKey[] {
  return allNavItems.filter((i) => i.roles.includes(role)).map((i) => i.key)
}

export default function Sidebar({
  active,
  role,
  onNavigate,
}: {
  active: PageKey
  role: Role
  onNavigate: (key: PageKey) => void
}) {
  const items = allNavItems.filter((i) => i.roles.includes(role))
  const { navBg } = useThemeBg()

  /* 悬浮圆角卡片：渐变背景 + rounded-2xl + overflow-hidden，四周留白由 Layout 外层容器提供 */
  return (
    <aside
      className="flex h-full w-[120px] shrink-0 flex-col items-center overflow-hidden rounded-2xl py-5 shadow-lg"
      style={{ background: navBg }}
    >
      {/* 导航（LOGO 已移至顶栏） */}
      <nav className="flex w-full flex-1 flex-col items-center gap-1.5 px-3">
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = active === key
          /* 导航栏英文统一全部大写 */
          const text = label.toUpperCase()
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              className={cn(
                'flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-3 transition-all',
                isActive ? 'bg-white shadow-md' : 'hover:bg-white/10',
              )}
            >
              <Icon
                className={cn('h-5 w-5', isActive ? 'text-teal-500' : 'text-white/85')}
                strokeWidth={1.8}
              />
              <span
                className={cn(
                  'text-center text-[10px] leading-tight tracking-wide break-all',
                  isActive ? 'font-semibold text-teal-600' : 'text-white/85',
                )}
              >
                {text}
              </span>
            </button>
          )
        })}
      </nav>

      {/* 角色标识徽章 */}
      <div className="mt-4 rounded-full border border-white/30 px-2.5 py-0.5 text-[9px] tracking-wider text-white/70">
        {role === 'pm' ? '项目经理端' : role === 'executor' ? '执行人员端' : '系统管理端'}
      </div>
    </aside>
  )
}
