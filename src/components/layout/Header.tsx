import { useEffect, useState } from 'react'
import { BookOpen, Settings, FlaskConical, ChevronDown, LogOut, RotateCcw, Palette, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ToolbarSelect } from '@/components/common'
import { projectOptions } from '@/data/mock'
import { useStore, PM_USER, EX_USER, ADMIN_USER } from '@/store'
import { useThemeBg, BG_PRESETS, NAV_PRESETS, DEFAULT_BG, DEFAULT_NAV_BG, navBaseColor } from '@/lib/theme'
import { cn } from '@/lib/utils'
import BrandMark from '@/components/BrandMark'

function Clock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="text-right leading-tight">
      <div className="font-mono text-lg font-semibold tracking-wider text-gray-800 tabular-nums">
        {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
      </div>
      <div className="text-[10px] tracking-wide text-gray-400">
        {now.getFullYear()}-{pad(now.getMonth() + 1)}-{pad(now.getDate())}
      </div>
    </div>
  )
}

/** 用户区：头像 + 姓名/职务 + 角色徽章；下拉仅「退出登录」（角色由登录决定，不可切换） */
function UserMenu() {
  const { state, dispatch } = useStore()
  const role = state.role
  const user = role === 'pm' ? PM_USER : role === 'executor' ? EX_USER : ADMIN_USER
  const roleLabel = role === 'pm' ? '管理人员' : role === 'executor' ? '执行人员' : '系统管理员'

  const logout = () => {
    window.location.hash = ''
    dispatch({ type: 'logout' })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg px-2 py-1 outline-none transition-colors hover:bg-gray-50">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm',
            role === 'pm'
              ? 'bg-gradient-to-br from-teal-400 to-blue-500'
              : role === 'executor'
                ? 'bg-gradient-to-br from-orange-400 to-pink-500'
                : 'bg-gradient-to-br from-violet-500 to-indigo-600',
          )}
        >
          {user.name[0]}
        </div>
        <span className="text-sm whitespace-nowrap text-gray-700">
          {user.name} <span className="text-xs text-gray-400">{user.title}</span>
        </span>
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
            role === 'pm'
              ? 'bg-teal-50 text-teal-600'
              : role === 'executor'
                ? 'bg-blue-50 text-blue-600'
                : 'bg-violet-50 text-violet-600',
          )}
        >
          {user.badge}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-gray-400">
          当前账号：{user.name}（{roleLabel}）
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer gap-2.5 py-2.5 text-red-500 focus:text-red-500" onClick={logout}>
          <LogOut className="h-4 w-4" />
          <span className="text-sm">退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** 色板选择区块：预设色卡 + 自定义取色器 */
function ColorSection({
  title,
  presets,
  current,
  customValue,
  onPick,
  onCustom,
  onRestore,
}: {
  title: string
  presets: { name: string; value: string }[]
  current: string
  customValue: string
  onPick: (v: string) => void
  onCustom: (v: string) => void
  onRestore: () => void
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{title}</span>
        <button
          type="button"
          onClick={onRestore}
          className="text-[11px] text-gray-400 transition-colors hover:text-teal-600"
        >
          恢复默认
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {presets.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => onPick(p.value)}
            className="group flex flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                'flex h-10 w-full items-center justify-center rounded-xl ring-1 transition-all group-hover:scale-105',
                current === p.value
                  ? 'ring-2 ring-teal-500 ring-offset-2'
                  : 'ring-gray-200 group-hover:ring-teal-300',
              )}
              style={{ background: p.value }}
            >
              {current === p.value && <Check className="h-4 w-4 text-teal-600 mix-blend-difference" />}
            </span>
            <span className="text-[11px] text-gray-500">{p.name}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <label
          className="relative h-9 flex-1 cursor-pointer overflow-hidden rounded-xl ring-1 ring-gray-200 transition-shadow hover:ring-teal-300"
          style={{ background: customValue }}
        >
          <input
            type="color"
            value={customValue}
            onChange={(e) => onCustom(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white mix-blend-difference">
            自定义任意颜色
          </span>
        </label>
        <label
          className="relative h-[22px] w-[22px] shrink-0 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/10 transition-transform hover:scale-110"
          style={{ background: customValue }}
          title={`当前自定义颜色 ${customValue.toUpperCase()}，点击重新取色`}
        >
          <input
            type="color"
            value={customValue}
            onChange={(e) => onCustom(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  )
}

/** 设置菜单：页面背景 / 导航栏背景自定义 + 重置演示数据 */
function SettingsMenu() {
  const { bg, setBg, navBg, setNavBg } = useThemeBg()
  const [bgOpen, setBgOpen] = useState(false)

  const reset = () => {
    if (!window.confirm('确定重置演示数据吗？\n所有上传、审核、归档、递交记录将恢复为初始状态。')) return
    try {
      localStorage.removeItem('clinx-data-v1')
    } catch {
      /* 忽略 */
    }
    window.location.reload()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
          <Settings className="h-[18px] w-[18px] cursor-pointer transition-colors hover:text-teal-500" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs text-gray-400">系统设置</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer gap-2.5 py-2.5" onClick={() => setBgOpen(true)}>
            <Palette className="h-4 w-4 text-gray-500" />
            <span className="text-sm">外观背景</span>
            <span className="ml-auto flex items-center gap-1">
              <span className="h-4 w-4 rounded-full ring-1 ring-gray-200" style={{ background: bg }} />
              <span className="h-4 w-4 rounded-full ring-1 ring-gray-200" style={{ background: navBg }} />
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer gap-2.5 py-2.5" onClick={reset}>
            <RotateCcw className="h-4 w-4 text-gray-500" />
            <span className="text-sm">重置演示数据</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 外观背景选择弹窗 */}
      <Dialog open={bgOpen} onOpenChange={setBgOpen}>
        <DialogContent className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-md">
          <DialogTitle className="sr-only">外观背景</DialogTitle>
          <div className="flex items-center gap-2 bg-gradient-to-r from-teal-400 to-teal-500 px-5 py-3.5 text-white">
            <Palette className="h-4.5 w-4.5" />
            <span className="text-[15px] font-medium">外观背景</span>
          </div>
          <div className="max-h-[70vh] space-y-6 overflow-y-auto p-5">
            <ColorSection
              title="页面背景"
              presets={BG_PRESETS}
              current={bg}
              customValue={bg}
              onPick={setBg}
              onCustom={setBg}
              onRestore={() => setBg(DEFAULT_BG)}
            />
            <div className="border-t border-gray-100" />
            <ColorSection
              title="导航栏背景"
              presets={NAV_PRESETS}
              current={navBg}
              customValue={navBaseColor(navBg)}
              onPick={setNavBg}
              onCustom={setNavBg}
              onRestore={() => setNavBg(DEFAULT_NAV_BG)}
            />
            <div className="flex justify-end border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setBgOpen(false)}
                className="rounded-lg bg-teal-500 px-5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-600"
              >
                完成
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function Header() {
  const { state, dispatch } = useStore()
  const headerOptions = [{ label: '全部项目', value: '全部' }, ...projectOptions]

  return (
    /* 顶栏通栏：底边分隔线横贯全宽（border-b + shadow-sm + z-10 强化分界，与下方导航/内容严格分隔）；
       左侧只保留 LOGO + 系统名称，页标题由 Layout 内容区顶部渲染 */
    <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5 shadow-sm">
      {/* R41：顶栏左侧 LOGO 区换登录页同款描边渐变字标（小尺寸版）+ 竖线 + 中文名/英文大写渐变副标题双行 */}
      <div className="flex items-center gap-3">
        <BrandMark className="h-7 w-auto" />
        <div aria-hidden className="h-6 w-px bg-gray-200" />
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-wide text-gray-800">研究文件管理系统</div>
          <div className="bg-gradient-to-r from-teal-500 to-violet-500 bg-clip-text text-[8px] font-semibold tracking-[0.16em] text-transparent uppercase">
            Document Management System
          </div>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {/* 项目筛选仅业务端（PM/CRA）展示，后台管理端隐藏 */}
        {state.role !== 'admin' && (
          <ToolbarSelect
            ghost
            value={state.activeProject}
            onChange={(p) => dispatch({ type: 'setActiveProject', project: p })}
            options={headerOptions}
          />
        )}

        <UserMenu />

        <div className="flex items-center gap-3.5 text-gray-400">
          <BookOpen className="h-[18px] w-[18px] cursor-pointer transition-colors hover:text-teal-500" />
          <SettingsMenu />
          <FlaskConical className="h-[18px] w-[18px] cursor-pointer transition-colors hover:text-teal-500" />
        </div>

        <Clock />
      </div>
    </header>
  )
}
