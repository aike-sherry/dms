import { useMemo, useState } from 'react'
import { Plus, Download, Trash2, CalendarDays, FolderOpen, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { zhCN } from 'react-day-picker/locale'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageCard, DataTable, Th, Td, NameTd, NameTh, Tr, FileTypeIcon, TealLink, parseDateStr, fmtDateStr } from '@/components/common'
import SubmissionDialog from '@/components/SubmissionDialog'
import { submissionFolderFiles } from '@/data/mock'
import { useStore, type Submission as SubmissionRow } from '@/store'
import { cn } from '@/lib/utils'

/* 日期解析/格式化与日历面板样式统一走 common（R31 起共享） */
const parseDate = parseDateStr
const fmtDate = fmtDateStr

/** 日历选择单元格：点击弹出日历面板选择递交日期（R35：placeholder 可配，矩阵未录入态显示「待递交」） */
function DatePickCell({ value, onChange, placeholder = '选择日期' }: { value: string; onChange: (date: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseDate(value) : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex w-36 items-center justify-between gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors',
            value
              ? 'border-teal-300 bg-teal-50/50 text-gray-700 hover:border-teal-400'
              : 'border-dashed border-gray-300 text-gray-400 hover:border-teal-300 hover:text-teal-600',
          )}
        >
          {value || placeholder}
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-teal-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={zhCN}
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            if (d) onChange(fmtDate(d))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export function OverviewTable({
  rows: rowsProp,
  editableHospitals,
  onSaveDate,
}: {
  /** R35：调用方可传入过滤后的矩阵行（执行端按本人负责项目过滤）；不传则全量 */
  rows?: import('@/store').SubmissionScheduleRow[]
  /** R35：可点击录入递交日期的中心列（执行端=本人负责的中心）；不传则全表只读（PM 端） */
  editableHospitals?: readonly string[]
  /** R35：单元格选定日期即保存 */
  onSaveDate?: (rowId: string, hospital: string, date: string) => void
}) {
  const { state } = useStore()
  const rows = rowsProp ?? state.submissionSchedule
  /* R32：矩阵中心列动态渲染——注册表中心名去重（中文排序）；空注册表时无中心列并显示配置引导 */
  const centerCols = useMemo(
    () => [...new Set(state.centers.map((c) => c.name))].sort((a, b) => a.localeCompare(b, 'zh')),
    [state.centers],
  )

  return (
    /* 递交矩阵保持 auto 布局：首行橙色合并表头 + 动态医院列数，不适合 fixed 定宽 */
    <>
    <DataTable className="table-auto">
      <thead>
        <tr>
          <th colSpan={3} className="bg-white px-4 py-2" />
          {centerCols.map((h, i) => (
            <th
              key={h}
              className={`bg-[#f97316] px-4 py-2.5 text-center text-xs font-medium whitespace-nowrap text-white ${
                i === 0 ? 'rounded-tl-lg' : ''
              } ${i === centerCols.length - 1 ? 'rounded-tr-lg' : ''}`}
            >
              {h}
            </th>
          ))}
        </tr>
        <tr>
          <Th sortable={false}>递交主题</Th>
          <Th sortable={false}>发布日期</Th>
          <Th sortable={false}>目标递交时限</Th>
          {centerCols.map((h) => (
            <th key={h} className="bg-orange-50 px-4 py-2.5 text-center text-xs font-normal whitespace-nowrap text-orange-400">
              递交日期
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td>{r.topic}</Td>
            <Td>{r.publishDate}</Td>
            <Td>{r.deadline || '—'}</Td>
            {centerCols.map((h) => {
              const date = r.dates[h] ?? ''
              const editable = editableHospitals?.includes(h) ?? false
              return (
                <Td key={h} className="text-center">
                  {editable ? (
                    /* R35：本中心单元格点击弹出日历，选定即保存；未录入显示「待递交」 */
                    <DatePickCell
                      value={date}
                      placeholder="待递交"
                      onChange={(d) => onSaveDate?.(r.id, h, d)}
                    />
                  ) : date ? (
                    date
                  ) : (
                    <span className="text-gray-300" title={editableHospitals ? '仅本中心可录入' : undefined}>
                      待递交
                    </span>
                  )}
                </Td>
              )
            })}
          </Tr>
        ))}
      </tbody>
    </DataTable>
    {centerCols.length === 0 && (
      <p className="mt-3 rounded-lg bg-amber-50/70 px-3 py-2 text-xs text-amber-600 ring-1 ring-amber-100">
        尚未配置研究中心：请先在首页「研究中心管理」中添加，递交矩阵将按中心动态生成日期列
      </p>
    )}
    </>
  )
}

export default function Submission() {
  const { state, dispatch } = useStore()
  const [dialogOpen, setDialogOpen] = useState(() => window.location.hash.includes('newsub'))
  /* R34：页面级拖拽带入新建递交弹窗的文件（松手自动成行）；拖拽悬停高亮 */
  const [dropFiles, setDropFiles] = useState<File[] | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [folderView, setFolderView] = useState<SubmissionRow | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [folderSel, setFolderSel] = useState<Set<string>>(new Set())
  /* 递交文件列表带项目编号维度：静默跟随全局项目筛选（递交概况矩阵无项目维度，不过滤） */
  const project = state.activeProject
  const files = state.submissions.filter((f) => project === '全部' || f.projectNo.startsWith(project))

  const toggleIn = (set: Set<string>, key: string, checked: boolean) => {
    const next = new Set(set)
    if (checked) next.add(key)
    else next.delete(key)
    return next
  }

  const downloadFiles = (list: { name?: string; fileName?: string }[]) => {
    if (list.length === 0) {
      toast.info('暂无可下载的文件')
      return
    }
    const names = list.slice(0, 3).map((f) => f.name ?? f.fileName ?? '').join('、')
    toast.success(`已开始下载 ${list.length} 个文件`, {
      description: names + (list.length > 3 ? ` 等 ${list.length} 个文件` : ''),
    })
  }

  const publish = (id: string) => {
    dispatch({ type: 'publishSubmission', id })
    toast.success('发布成功', { description: '执行人员 SUBMISSION 页已可见' })
  }

  const removeLast = () => {
    const last = files[files.length - 1]
    if (!last) {
      toast.warning('列表已为空')
      return
    }
    dispatch({ type: 'removeSubmission', id: last.id })
    toast.success('已删除一行')
  }

  return (
    <div className="space-y-5">
      <PageCard title="递交概况">
        <OverviewTable />
      </PageCard>

      {/* R34：递交文件卡片区域支持页面级拖拽——松手后每条文件在新建递交弹窗中自动成行 */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const dropped = Array.from(e.dataTransfer?.files ?? [])
          if (dropped.length === 0) return
          setDropFiles(dropped)
          setDialogOpen(true)
        }}
        className={cn('rounded-2xl transition-all', dragOver && 'bg-teal-50/40 ring-2 ring-teal-300 ring-offset-2')}
      >
      <PageCard
        title="递交文件"
        extra={
          <div className="flex items-center gap-2">
            <span className="mr-1 hidden text-[11px] text-gray-300 lg:inline">可拖拽本地文件到此区域快速新建递交</span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => {
                setDropFiles(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="h-3.5 w-3.5" /> 新建
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={removeLast}>
              <Trash2 className="h-3.5 w-3.5" /> 删除
            </Button>
            {sel.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs text-gray-400 hover:text-gray-600"
                onClick={() => setSel(new Set())}
              >
                <X className="h-3.5 w-3.5" /> 取消选择
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 border-teal-200 text-xs text-teal-600 hover:bg-teal-50 hover:text-teal-700"
              onClick={() => {
                downloadFiles(sel.size ? files.filter((f) => sel.has(f.id)) : files)
                setSel(new Set())
              }}
            >
              <Download className="h-3.5 w-3.5" /> 下载{sel.size ? ` 所选（${sel.size}）` : ' 全部'}
            </Button>
          </div>
        }
      >
        <DataTable>
          <thead>
            <tr>
              <Th sortable={false} className="w-10">
                <input
                  type="checkbox"
                  aria-label="全选"
                  className="h-4 w-4 cursor-pointer accent-teal-600"
                  ref={(el) => {
                    if (el) el.indeterminate = sel.size > 0 && sel.size < files.length
                  }}
                  checked={files.length > 0 && sel.size === files.length}
                  onChange={(e) => setSel(e.target.checked ? new Set(files.map((f) => f.id)) : new Set())}
                />
              </Th>
              <Th sortable={false} className="w-52">递交主题</Th>
              <NameTh className="w-[22%]">文件</NameTh>
              <Th className="w-36">项目编号</Th>
              <Th className="w-36">上传日期</Th>
              <Th className="w-28">文件大小</Th>
              <Th sortable={false} className="w-24">操作</Th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <Tr key={f.id}>
                <Td className="w-10">
                  <input
                    type="checkbox"
                    aria-label={`选择 ${f.fileName}`}
                    className="h-4 w-4 cursor-pointer accent-teal-600"
                    checked={sel.has(f.id)}
                    onChange={(e) => setSel((prev) => toggleIn(prev, f.id, e.target.checked))}
                  />
                </Td>
                <Td>{f.topic}</Td>
                <NameTd>
                  <span className="flex items-center gap-2.5">
                    <FileTypeIcon kind={f.kind} />
                    {f.kind === 'folder' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFolderView(f)
                          setFolderSel(new Set())
                        }}
                        title="点击打开文件夹"
                        className="text-gray-700 underline decoration-teal-300 decoration-dotted underline-offset-4 transition-colors hover:text-teal-600"
                      >
                        {f.fileName}
                      </button>
                    ) : (
                      <span className="truncate text-gray-700">{f.fileName}</span>
                    )}
                  </span>
                </NameTd>
                <Td>{f.projectNo}</Td>
                <Td>{f.uploadDate}</Td>
                <Td>{f.size}</Td>
                <Td>
                  {f.published ? (
                    <span className="text-sm text-gray-400">已发布</span>
                  ) : (
                    <TealLink onClick={() => publish(f.id)}>发布</TealLink>
                  )}
                </Td>
              </Tr>
            ))}
            {files.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                  暂无递交文件
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </PageCard>
      </div>

      {/* R34：上传能力并入新建递交弹窗（行内本地/TMF 两渠道 + 提交即发布）；拖拽带入的文件随弹窗关闭清空 */}
      <SubmissionDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o)
          if (!o) setDropFiles(null)
        }}
        initialFiles={dropFiles}
      />

      {/* 文件夹内容查看/下载弹窗 */}
      <Dialog open={!!folderView} onOpenChange={(o) => !o && setFolderView(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-5 w-5 text-amber-500" />
              {folderView?.fileName}
            </DialogTitle>
          </DialogHeader>
          {folderView && (
            <>
              <DataTable>
                <thead>
                  <tr>
                    <Th sortable={false} className="w-10">
                      <input
                        type="checkbox"
                        aria-label="全选"
                        className="h-4 w-4 cursor-pointer accent-teal-600"
                        ref={(el) => {
                          const n = (submissionFolderFiles[folderView.id] ?? []).length
                          if (el) el.indeterminate = folderSel.size > 0 && folderSel.size < n
                        }}
                        checked={(submissionFolderFiles[folderView.id] ?? []).length > 0 && folderSel.size === (submissionFolderFiles[folderView.id] ?? []).length}
                        onChange={(e) =>
                          setFolderSel(
                            e.target.checked
                              ? new Set((submissionFolderFiles[folderView.id] ?? []).map((f) => f.name))
                              : new Set()
                          )
                        }
                      />
                    </Th>
                    <NameTh>文件名称</NameTh>
                    <Th sortable={false} className="w-28">文件大小</Th>
                    <Th sortable={false} className="w-20">操作</Th>
                  </tr>
                </thead>
                <tbody>
                  {(submissionFolderFiles[folderView.id] ?? []).map((f) => (
                    <Tr key={f.name}>
                      <Td className="w-10">
                        <input
                          type="checkbox"
                          aria-label={`选择 ${f.name}`}
                          className="h-4 w-4 cursor-pointer accent-teal-600"
                          checked={folderSel.has(f.name)}
                          onChange={(e) => setFolderSel((prev) => toggleIn(prev, f.name, e.target.checked))}
                        />
                      </Td>
                      <NameTd>
                        <span className="flex min-w-0 items-center gap-2.5">
                          <FileTypeIcon kind={f.kind} />
                          <span className="truncate text-gray-700">{f.name}</span>
                        </span>
                      </NameTd>
                      <Td>{f.size}</Td>
                      <Td>
                        <TealLink onClick={() => downloadFiles([f])}>下载</TealLink>
                      </Td>
                    </Tr>
                  ))}
                  {(submissionFolderFiles[folderView.id] ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-sm text-gray-400">
                        文件夹内暂无文件
                      </td>
                    </tr>
                  )}
                </tbody>
              </DataTable>
              <div className="mt-4 flex items-center justify-end gap-2">
                {folderSel.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-gray-400 hover:text-gray-600"
                    onClick={() => setFolderSel(new Set())}
                  >
                    <X className="h-3.5 w-3.5" /> 取消选择
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 border-teal-200 text-xs text-teal-600 hover:bg-teal-50 hover:text-teal-700"
                  onClick={() => {
                    const all = submissionFolderFiles[folderView.id] ?? []
                    downloadFiles(folderSel.size ? all.filter((f) => folderSel.has(f.name)) : all)
                    setFolderSel(new Set())
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> 下载{folderSel.size ? ` 所选（${folderSel.size}）` : ' 全部'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
