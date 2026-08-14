import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronsUpDown, Folder, FileText, Search, Star, FolderOpen, X, Maximize2, Minimize2, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import type { FileKind, SelectOption } from '@/data/mock'
import { Calendar } from '@/components/ui/calendar'
import { zhCN } from 'react-day-picker/locale'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/* ---------- 日期工具与日历选择字段（R31 共享：上传递交/新建递交弹窗与执行端日期录入同一套日历面板） ---------- */

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}
export function fmtDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 日历选择字段：表单风格触发框 + teal 主题日历面板（月份翻页/今天高亮/选中 teal 圆点），选中显示 YYYY-MM-DD */
export function DatePickerField({
  value,
  onChange,
  placeholder = '选择日期',
  className,
}: {
  value: string
  onChange: (date: string) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseDateStr(value) : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex w-full items-center justify-between gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition-colors outline-none hover:border-teal-400 focus:border-teal-500',
            value ? 'text-gray-700' : 'text-gray-400',
            className,
          )}
        >
          {value || placeholder}
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-teal-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-xl p-0 shadow-lg">
        <Calendar
          mode="single"
          locale={zhCN}
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) onChange(fmtDateStr(d))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/* ---------- 白色卡片容器 ---------- */

export function PageCard({
  title,
  extra,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode
  extra?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <div className={cn('rounded-2xl bg-white p-6 shadow-[0_1px_10px_rgba(15,23,42,0.05)]', className)}>
      {(title || extra) && (
        <div className="mb-5 flex items-center justify-between">
          {typeof title === 'string' ? (
            <h2 className="text-[15px] font-semibold text-gray-800">{title}</h2>
          ) : (
            title
          )}
          {extra}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}

/* ---------- 统一表格 ---------- */

export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    /* R27 全系统统一列版式：table-fixed——各列宽由表头 Th 的 w-* 类定宽，未指定的列均分剩余空间，
       杜绝 auto 布局下"名称列特别宽、大片空白"；内容超长由 Td 的 truncate 省略号截断。
       个别需保持 auto 布局的表（如 SUBMISSION 递交矩阵）可传 className="table-auto" 覆盖 */
    <table className={cn('w-full table-fixed border-separate border-spacing-0 text-sm', className)}>
      {children}
    </table>
  )
}

export function Th({
  children,
  className,
  sortable = true,
}: {
  children?: ReactNode
  className?: string
  sortable?: boolean
}) {
  return (
    <th
      className={cn(
        'overflow-hidden bg-[#f6f7f9] px-4 py-3 text-center text-xs font-normal whitespace-nowrap text-gray-400 first:rounded-l-lg last:rounded-r-lg',
        className,
      )}
    >
      <span className="inline-flex max-w-full items-center gap-1">
        {children}
        {sortable && <ChevronsUpDown className="h-3 w-3 shrink-0 text-gray-300" />}
      </span>
    </th>
  )
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td
      className={cn(
        'truncate border-b border-gray-100 px-4 py-4 text-center whitespace-nowrap text-gray-600',
        className,
      )}
    >
      {children}
    </td>
  )
}

export function Tr({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={cn('transition-colors hover:bg-gray-50/70', onClick && 'cursor-pointer', className)}
    >
      {children}
    </tr>
  )
}

/* ---------- 工具栏下拉选择器（原生 select 样式化） ---------- */

export function ToolbarSelect({
  value,
  onChange,
  options,
  className,
  ghost = false,
}: {
  value: string
  onChange?: (v: string) => void
  options: SelectOption[] | string[]
  className?: string
  ghost?: boolean
}) {
  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          'cursor-pointer appearance-none rounded-lg py-1.5 pr-7 pl-3 text-sm text-gray-600 outline-none transition-colors',
          ghost
            ? 'border border-transparent bg-transparent hover:border-gray-200'
            : 'border border-gray-200 bg-white hover:border-teal-400 focus:border-teal-500',
        )}
      >
        {options.map((o) =>
          typeof o === 'string' ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ),
        )}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-gray-400" />
    </div>
  )
}

/* ---------- 搜索输入框 ---------- */

export function SearchInput({
  value,
  onChange,
  placeholder = '请输入搜索内容',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-white py-2 pr-3 pl-9 text-sm text-gray-700 outline-none placeholder:text-gray-400 hover:border-teal-400 focus:border-teal-500"
      />
    </div>
  )
}

/* ---------- 文件类型图标 ---------- */

export function FileTypeIcon({ kind, className }: { kind: FileKind; className?: string }) {
  if (kind === 'folder') {
    return <Folder className={cn('h-[18px] w-[18px] fill-amber-300 text-amber-400', className)} />
  }
  return (
    <span className={cn('inline-flex h-[18px] w-[18px] items-center justify-center rounded-[4px] bg-red-500', className)}>
      <FileText className="h-3 w-3 text-white" />
    </span>
  )
}

/* ---------- 文件状态 pill（带 chevron） ---------- */

export function StatusPill({ status }: { status: '完成' | '未完成' }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors',
        status === '完成'
          ? 'border-teal-200 bg-teal-50 text-teal-600'
          : 'border-gray-200 bg-gray-50 text-gray-500',
      )}
    >
      {status}
      <ChevronDown className="h-3 w-3 opacity-60" />
    </button>
  )
}

/* ---------- teal 文本链接 ---------- */

export function TealLink({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={cn('text-sm text-teal-500 transition-colors hover:text-teal-600 hover:underline', className)}
    >
      {children}
    </button>
  )
}

/** 文件/文件夹名称单元格（R33 设计规范「标题居中、字段居中」）：图标+名称作为整体在行内水平居中，
    不再左对齐（R26/R28 左对齐逻辑已回滚）；aside 内容（如收藏星标）跟随在名称组右侧；长名称省略号截断 */
export function NameTd({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <Td>
      <span className="flex w-full min-w-0 items-center justify-center gap-2.5">
        <span className="flex min-w-0 items-center gap-2.5 [&_button]:truncate [&_span]:min-w-0">
          {children}
        </span>
        {aside}
      </span>
    </Td>
  )
}

/** 名称列表头（R33 统一居中）：与全部表头一致水平居中，R28 的左对齐 + pl-6 缩进逻辑回滚；
    列宽仍由调用方 className 给定（主列表用 w-[xx%] 占比，超长由 NameTd truncate） */
export function NameTh({ children, className }: { children?: ReactNode; className?: string }) {
  return <Th sortable={false} className={className}>{children}</Th>
}

/* ---------- 收藏星标（仅具体文件使用，文件夹不展示） ---------- */

export function FavButton({ id, className }: { id: string; className?: string }) {
  const { state, dispatch } = useStore()
  const fav = id in state.favorites
  return (
    <button
      type="button"
      title={fav ? '取消收藏' : '收藏'}
      onClick={(e) => {
        e.stopPropagation()
        dispatch({ type: 'toggleFavorite', id })
        toast.success(fav ? '已取消收藏' : '已收藏')
      }}
      className={cn(
        'shrink-0 transition-colors',
        fav ? 'text-teal-500 hover:text-gray-300' : 'text-gray-300 hover:text-teal-500',
        className,
      )}
    >
      <Star className={cn('h-4 w-4', fav && 'fill-teal-500')} />
    </button>
  )
}

/* ---------- 弹窗共用：teal 渐变头部 / 顶部信息字段（自 CatalogDialog 迁入，供各弹窗共用） ---------- */

export function ModalHeader({
  title,
  onClose,
  maximized,
  onToggleMaximize,
}: {
  title: string
  onClose: () => void
  /* 最大化/还原（可选）：仅当调用方传入 onToggleMaximize 时按钮才可点击并切换图标；
     未传入的弹窗保持原装饰图标，行为不受影响 */
  maximized?: boolean
  onToggleMaximize?: () => void
}) {
  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-teal-400 to-teal-500 px-5 py-3.5">
      <div className="flex items-center gap-2 text-white">
        <FolderOpen className="h-4.5 w-4.5" />
        <span className="text-[15px] font-medium">{title}</span>
      </div>
      <div className="flex items-center gap-3 text-white/90">
        {onToggleMaximize ? (
          <button
            type="button"
            title={maximized ? '还原' : '最大化'}
            onClick={onToggleMaximize}
            className="cursor-pointer transition-opacity hover:opacity-70"
          >
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        ) : (
          <Maximize2 className="h-4 w-4 cursor-pointer transition-opacity hover:opacity-70" />
        )}
        <X className="h-4.5 w-4.5 cursor-pointer transition-opacity hover:opacity-70" onClick={onClose} />
      </div>
    </div>
  )
}

export function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-800">{value}</div>
    </div>
  )
}
