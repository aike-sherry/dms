import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, FolderOpen, X, HardDrive, FolderTree } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileTypeIcon } from '@/components/common'
import { cn } from '@/lib/utils'
import { useStore, nextId, todayStr, fmtSize, type Submission, type Catalog } from '@/store'

/* 递交文件上传：两个渠道——① 本地电脑上传；② 从 STUDY TMF 文件夹中选择已归档文件 */
export default function UploadSubmissionDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState<'local' | 'tmf'>('local')

  /* 本地上传 */
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localFiles, setLocalFiles] = useState<File[]>([])

  /* STUDY TMF 选择 */
  const studyCatalogs = useMemo(() => state.catalogs.filter((c) => c.kind === 'study'), [state.catalogs])
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const catalogFiles = useMemo(
    () =>
      catalog
        ? state.files.filter((f) => f.folderId === catalog.id && f.status === 'archived' && !f.parentId)
        : [],
    [state.files, catalog],
  )

  /* 本地文件的项目编号：取 STUDY 目录中出现过的编号 */
  const projectNos = useMemo(
    () => [...new Set(studyCatalogs.map((c) => c.projectNo))],
    [studyCatalogs],
  )
  const [projectNo, setProjectNo] = useState('')

  useEffect(() => {
    if (open) {
      setTab('local')
      setLocalFiles([])
      setCatalog(null)
      setSel(new Set())
      setProjectNo(projectNos[0] ?? 'ON101CL103')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pickLocal = (list: FileList | null) => {
    if (!list) return
    setLocalFiles((prev) => [...prev, ...Array.from(list)])
  }

  const toggleSel = (id: string, checked: boolean) => {
    setSel((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const confirmLocal = () => {
    if (localFiles.length === 0) {
      toast.warning('请先选择要上传的文件')
      return
    }
    const submissions: Submission[] = localFiles.map((f) => ({
      id: nextId('s'),
      topic: f.name,
      fileName: f.name,
      kind: 'pdf' as const,
      projectNo: projectNo || 'ON101CL103',
      uploadDate: todayStr(),
      size: fmtSize(f.size),
      published: false,
    }))
    dispatch({ type: 'addSubmissions', submissions })
    toast.success(`已从本地上传 ${submissions.length} 个文件`, { description: '发布后执行端可见' })
    onOpenChange(false)
  }

  const confirmTmf = () => {
    const picked = catalogFiles.filter((f) => sel.has(f.id))
    if (picked.length === 0) {
      toast.warning('请先勾选要上传的文件')
      return
    }
    const submissions: Submission[] = picked.map((f) => ({
      id: nextId('s'),
      topic: f.name,
      fileName: f.name,
      kind: f.kind,
      projectNo: f.projectNo,
      uploadDate: todayStr(),
      size: f.size,
      published: false,
    }))
    dispatch({ type: 'addSubmissions', submissions })
    toast.success(`已从 STUDY TMF 引入 ${submissions.length} 个文件`, {
      description: `来源目录：${catalog?.name ?? ''}`,
    })
    onOpenChange(false)
  }

  const tabs = [
    { key: 'local' as const, label: '本地上传', icon: HardDrive },
    { key: 'tmf' as const, label: '从 STUDY TMF 选择', icon: FolderTree },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">上传递交文件</DialogTitle>
        </DialogHeader>

        {/* 渠道切换 */}
        <div className="flex gap-2 border-b border-gray-100 pb-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm transition-colors',
                tab === t.key
                  ? 'bg-teal-50 font-medium text-teal-600'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700',
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'local' ? (
          <div className="space-y-4">
            {/* 选择文件区 */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-8 text-gray-400 transition-colors hover:border-teal-300 hover:text-teal-500"
            >
              <Upload className="h-6 w-6" />
              <span className="text-sm">点击选择本地文件（可多选）</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                pickLocal(e.target.files)
                e.target.value = ''
              }}
            />

            {/* 项目编号 */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">项目编号</span>
              <select
                value={projectNo}
                onChange={(e) => setProjectNo(e.target.value)}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-sm text-gray-700 outline-none focus:border-teal-400"
              >
                {projectNos.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* 待上传列表 */}
            {localFiles.length > 0 && (
              <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-gray-100 p-3">
                {localFiles.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center gap-2.5 text-sm">
                    <FileTypeIcon kind="pdf" />
                    <span className="flex-1 truncate text-gray-700">{f.name}</span>
                    <span className="text-xs text-gray-400">{fmtSize(f.size)}</span>
                    <button
                      type="button"
                      title="移除"
                      onClick={() => setLocalFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-gray-300 transition-colors hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button size="sm" className="gap-1 bg-teal-500 hover:bg-teal-600" onClick={confirmLocal}>
                <Upload className="h-3.5 w-3.5" /> 确认上传{localFiles.length > 0 && `（${localFiles.length}）`}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-3">
              {/* 左：STUDY TMF 目录 */}
              <div className="col-span-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-2">
                {studyCatalogs.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCatalog(c)
                      setSel(new Set())
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      catalog?.id === c.id ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    <FolderOpen className={cn('h-4 w-4 shrink-0', catalog?.id === c.id ? 'text-teal-500' : 'text-amber-400')} />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
                {studyCatalogs.length === 0 && (
                  <p className="py-8 text-center text-xs text-gray-400">暂无 STUDY TMF 目录</p>
                )}
              </div>

              {/* 右：目录内已归档文件 */}
              <div className="col-span-3 max-h-64 overflow-y-auto rounded-xl border border-gray-100 p-2">
                {catalog === null ? (
                  <p className="py-8 text-center text-xs text-gray-400">请先选择左侧目录</p>
                ) : catalogFiles.length === 0 ? (
                  <p className="py-8 text-center text-xs text-gray-400">该目录暂无已归档文件</p>
                ) : (
                  <div className="space-y-1">
                    {catalogFiles.map((f) => (
                      <label
                        key={f.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-teal-600"
                          checked={sel.has(f.id)}
                          onChange={(e) => toggleSel(f.id, e.target.checked)}
                        />
                        <FileTypeIcon kind={f.kind} />
                        <span className="flex-1 truncate text-gray-700">{f.name}</span>
                        <span className="text-xs text-gray-400">{f.size}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {catalog ? `当前目录：${catalog.name}，已选 ${sel.size} 个文件` : '仅显示已归档（审批通过）的文件'}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button size="sm" className="gap-1 bg-teal-500 hover:bg-teal-600" onClick={confirmTmf}>
                  <Upload className="h-3.5 w-3.5" /> 确认引入{sel.size > 0 && `（${sel.size}）`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
