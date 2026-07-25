import type { ReactNode } from 'react'
import { ChevronDown, ChevronsUpDown, Folder, FileText, Search, Star } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import type { FileKind, SelectOption } from '@/data/mock'

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
    <table className={cn('w-full border-separate border-spacing-0 text-sm', className)}>
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
        'bg-[#f6f7f9] px-4 py-3 text-center text-xs font-normal whitespace-nowrap text-gray-400 first:rounded-l-lg last:rounded-r-lg',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && <ChevronsUpDown className="h-3 w-3 text-gray-300" />}
      </span>
    </th>
  )
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cn('border-b border-gray-100 px-4 py-4 text-center whitespace-nowrap text-gray-600', className)}>
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

/** 文件/文件夹名称单元格：左对齐（保留适度左内边距），aside 内容（如收藏星标）固定在右侧 */
export function NameTd({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <Td className="text-left">
      <span className="flex w-full items-center gap-2.5 pl-20">
        <span className="flex min-w-0 flex-1 items-center gap-2.5">{children}</span>
        {aside}
      </span>
    </Td>
  )
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
