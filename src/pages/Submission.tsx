import { useState } from 'react'
import { Plus, Download, Trash2, Upload, CalendarDays, FolderOpen, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { zhCN } from 'react-day-picker/locale'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageCard, DataTable, Th, Td, NameTd, Tr, FileTypeIcon, TealLink } from '@/components/common'
import SubmissionDialog from '@/components/SubmissionDialog'
import UploadSubmissionDialog from '@/components/UploadSubmissionDialog'
import { submissionFolderFiles, submissionHospitals } from '@/data/mock'
import { useStore, type Submission as SubmissionRow } from '@/store'
import { cn } from '@/lib/utils'

function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function fmtDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 日历选择单元格：点击弹出日历面板选择递交日期 */
function DatePickCell({ value, onChange }: { value: string; onChange: (date: string) => void }) {
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
          {value || '选择日期'}
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
  editHospital,
  draft,
  onDateChange,
}: {
  /** 处于编辑模式的医院列（仅该列可编辑）；不传则全表只读 */
  editHospital?: string
  /** 编辑草稿：key 为 `${rowId}|${hospital}` */
  draft?: Record<string, string>
  onDateChange?: (rowId: string, hospital: string, date: string) => void
}) {
  const { state } = useStore()
  const rows = state.submissionSchedule

  return (
    <DataTable>
      <thead>
        <tr>
          <th colSpan={3} className="bg-white px-4 py-2" />
          {submissionHospitals.map((h, i) => (
            <th
              key={h}
              className={`bg-[#f97316] px-4 py-2.5 text-center text-xs font-medium whitespace-nowrap text-white ${
                i === 0 ? 'rounded-tl-lg' : ''
              } ${i === submissionHospitals.length - 1 ? 'rounded-tr-lg' : ''}`}
            >
              {h}
            </th>
          ))}
        </tr>
        <tr>
          <Th sortable={false}>递交主题</Th>
          <Th sortable={false}>发布日期</Th>
          <Th sortable={false}>目标递交时限</Th>
          {submissionHospitals.map((h) => (
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
            <Td>{r.deadline}</Td>
            {submissionHospitals.map((h) => {
              const date = r.dates[h] ?? ''
              const editable = editHospital === h
              return (
                <Td key={h} className="text-center">
                  {editable ? (
                    <DatePickCell
                      value={draft?.[`${r.id}|${h}`] ?? date}
                      onChange={(d) => onDateChange?.(r.id, h, d)}
                    />
                  ) : editHospital ? (
                    <span className="text-gray-400" title="仅本中心可录入">
                      {date || '—'}
                    </span>
                  ) : date ? (
                    date
                  ) : (
                    <span className="text-gray-300">待录入</span>
                  )}
                </Td>
              )
            })}
          </Tr>
        ))}
      </tbody>
    </DataTable>
  )
}

export default function Submission() {
  const { state, dispatch } = useStore()
  const [dialogOpen, setDialogOpen] = useState(() => window.location.hash.includes('newsub'))
  const [uploadOpen, setUploadOpen] = useState(false)
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

      <PageCard
        title="递交文件"
        extra={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setUploadOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> 上传
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setDialogOpen(true)}>
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
              <Th sortable={false}>递交主题</Th>
              <Th>文件</Th>
              <Th>项目编号</Th>
              <Th>上传日期</Th>
              <Th>文件大小</Th>
              <Th sortable={false}>操作</Th>
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
                      <span className="text-gray-700">{f.fileName}</span>
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

      <SubmissionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <UploadSubmissionDialog open={uploadOpen} onOpenChange={setUploadOpen} />

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
                    <Th sortable={false}>文件名称</Th>
                    <Th sortable={false}>文件大小</Th>
                    <Th sortable={false}>操作</Th>
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
                        <span className="flex items-center gap-2.5">
                          <FileTypeIcon kind={f.kind} />
                          <span className="text-gray-700">{f.name}</span>
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
