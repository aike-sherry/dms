import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Send, Upload, FolderTree, FolderOpen, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DataTable, Th, Td, Tr, DatePickerField, FileTypeIcon } from '@/components/common'
import { InfoField, ModalHeader } from '@/components/CatalogDialog'
import { cn } from '@/lib/utils'
import { useStore, nextId, todayStr, fmtSize, PM_USER, type Catalog, type Submission } from '@/store'

/* 去扩展名：主题默认带入第一个文件名 */
const stripExt = (n: string) => n.replace(/\.[^.]+$/, '')

/** 行内待递交文件（本地新选或从 STUDY TMF 引入的已归档文件） */
interface RowFile {
  name: string
  size: string
  kind: string
  projectNo?: string
}
interface Row {
  id: string
  topic: string
  topicDirty: boolean
  projectNo: string
  deadline: string
  files: RowFile[]
}

/* R34：新建递交弹窗合并原「上传」能力——行结构：递交主题（必填）｜项目编号（下拉）｜目标时限（日历）｜
   文件上传（本地多选 / 从 STUDY TMF 选择两渠道）｜删除；顶部「＋新建」加行，底部「提交」全部行校验后
   一次性创建并发布（发布走 R29 数据流，递交概况矩阵即时同步）。
   initialFiles：页面级拖拽带入——松手后每条文件自动成行（主题默认文件名去扩展名，可改） */
export default function SubmissionDialog({
  open,
  onOpenChange,
  initialFiles,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 页面拖拽带入的本地文件：每个文件自动成一行待编辑记录 */
  initialFiles?: File[] | null
}) {
  const { state, dispatch } = useStore()
  const [rows, setRows] = useState<Row[]>([])
  /* 行内本地上传：当前点击的行 */
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pickRowRef = useRef<string | null>(null)
  /* 行内 STUDY TMF 选择（嵌套弹窗）：目标行 + 当前目录 + 勾选 */
  const [tmfRowId, setTmfRowId] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [tmfSel, setTmfSel] = useState<Set<string>>(new Set())

  const newRow = (patch?: Partial<Row>): Row => ({
    id: nextId('sub'),
    topic: '',
    topicDirty: false,
    projectNo: '',
    deadline: '',
    files: [],
    ...patch,
  })

  useEffect(() => {
    if (open) {
      if (initialFiles && initialFiles.length > 0) {
        setRows(
          initialFiles.map((f) =>
            newRow({
              topic: stripExt(f.name),
              topicDirty: true,
              files: [{ name: f.name, size: fmtSize(f.size), kind: 'pdf' }],
            }),
          ),
        )
      } else {
        setRows([newRow()])
      }
      setTmfRowId(null)
      setCatalog(null)
      setTmfSel(new Set())
    }
  }, [open, initialFiles])

  /* 项目编号下拉选项：目录 ∪ 研究中心注册表已有编号（去重排序） */
  const projectOptions = useMemo(
    () => [...new Set([...state.catalogs.map((c) => c.projectNo), ...state.centers.map((c) => c.projectNo)])].sort(),
    [state.catalogs, state.centers],
  )

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const addRow = () => setRows((prev) => [...prev, newRow()])
  const removeRow = (id: string) => {
    if (rows.length <= 1) {
      toast.warning('至少保留 1 行')
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
  }
  const removeFile = (id: string, name: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, files: r.files.filter((f) => f.name !== name) } : r)))

  /* 追加文件到行（按文件名去重）；主题未手改且为空时默认带入第一个文件名去扩展名；
     TMF 引入的文件自带项目编号，行内编号为空时跟随填入 */
  const addFilesToRow = (id: string, files: RowFile[]) => {
    if (files.length === 0) return
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const merged = [...r.files]
        for (const f of files) if (!merged.some((m) => m.name === f.name)) merged.push(f)
        return {
          ...r,
          files: merged,
          topic: !r.topicDirty && !r.topic.trim() ? stripExt(merged[0].name) : r.topic,
          projectNo: !r.projectNo && files[0]?.projectNo ? files[0].projectNo! : r.projectNo,
        }
      }),
    )
  }

  const pickLocal = (id: string) => {
    pickRowRef.current = id
    fileInputRef.current?.click()
  }
  const openTmfPicker = (id: string) => {
    setTmfRowId(id)
    setCatalog(null)
    setTmfSel(new Set())
  }

  /* STUDY TMF 选择数据 */
  const studyCatalogs = useMemo(() => state.catalogs.filter((c) => c.kind === 'study'), [state.catalogs])
  const catalogFiles = useMemo(
    () =>
      catalog
        ? state.files.filter((f) => f.folderId === catalog.id && f.status === 'archived' && !f.parentId)
        : [],
    [state.files, catalog],
  )
  const confirmTmf = () => {
    const picked = catalogFiles.filter((f) => tmfSel.has(f.id))
    if (picked.length === 0) {
      toast.warning('请先勾选要引入的文件')
      return
    }
    if (tmfRowId) addFilesToRow(tmfRowId, picked.map((f) => ({ name: f.name, size: f.size, kind: f.kind, projectNo: f.projectNo })))
    setTmfRowId(null)
  }

  /* 提交：全部行校验（主题必填 / 项目编号必选 / 每行至少 1 个文件）后一次性创建并发布，
     发布逐条走 publishSubmission（R29：同步生成递交概况矩阵行，topic 判重多文件合并一行） */
  const submit = () => {
    if (rows.length === 0) {
      toast.warning('请至少新建一条递交')
      return
    }
    if (rows.some((r) => !r.topic.trim())) {
      toast.warning('请填写递交主题', { description: '每行递交主题必填，发布后矩阵将以此为主题列' })
      return
    }
    if (rows.some((r) => !r.projectNo)) {
      toast.warning('请选择项目编号', { description: '每行需选择所属项目编号' })
      return
    }
    if (rows.some((r) => r.files.length === 0)) {
      toast.warning('请为每行上传文件', { description: '支持本地多选或从 STUDY TMF 选择已归档文件' })
      return
    }
    const submissions: Submission[] = rows.flatMap((r) =>
      r.files.map((f) => ({
        id: nextId('s'),
        topic: r.topic.trim(),
        fileName: f.name,
        kind: f.kind as Submission['kind'],
        projectNo: r.projectNo,
        uploadDate: todayStr(),
        size: f.size,
        published: false,
        deadline: r.deadline,
      })),
    )
    dispatch({ type: 'addSubmissions', submissions })
    submissions.forEach((s) => dispatch({ type: 'publishSubmission', id: s.id }))
    toast.success('递交创建并发布成功', {
      description: `已创建 ${rows.length} 条递交（共 ${submissions.length} 个文件），递交概况矩阵已同步，执行端可见`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        /* R34 加宽：行结构含文件上传列，原 sm:max-w-2xl 内容显示不全 */
        className="flex max-h-[92vh] w-[92vw] flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-[min(92vw,64rem)]"
      >
        <DialogTitle className="sr-only">新建递交</DialogTitle>
        <ModalHeader title="新建递交" onClose={() => onOpenChange(false)} />

        <div className="overflow-y-auto p-5">
          <div className="mb-5 grid grid-cols-3 gap-4">
            <InfoField label="创建人" value={PM_USER.name} />
            <InfoField label="职位" value="项目经理" />
            <InfoField label="创建日期" value={todayStr()} />
          </div>

          <div className="rounded-xl border border-gray-100 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">
                递交列表<span className="ml-1.5 text-xs font-normal text-gray-400">（{rows.length}）</span>
              </span>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addRow}>
                <Plus className="h-3.5 w-3.5" /> 新建
              </Button>
            </div>

            <div className="overflow-x-auto">
              <DataTable>
                <thead>
                  <tr>
                    <Th sortable={false} className="min-w-44">递交主题</Th>
                    <Th sortable={false} className="w-36">项目编号</Th>
                    <Th sortable={false} className="w-32">目标时限</Th>
                    <Th sortable={false} className="min-w-56">文件</Th>
                    <Th sortable={false} className="w-16">操作</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <input
                          value={row.topic}
                          onChange={(e) =>
                            updateRow(row.id, { topic: e.target.value, topicDirty: e.target.value.trim() !== '' })
                          }
                          placeholder="递交主题（必填）"
                          className={cn(
                            'w-44 rounded-md border px-2 py-1 text-center text-sm outline-none focus:border-teal-500',
                            row.topic.trim() ? 'border-teal-300' : 'border-amber-300 bg-amber-50/60',
                          )}
                        />
                      </Td>
                      <Td>
                        <select
                          value={row.projectNo}
                          onChange={(e) => updateRow(row.id, { projectNo: e.target.value })}
                          className={cn(
                            'w-32 rounded-md border bg-white px-2 py-1 text-center text-sm outline-none focus:border-teal-500',
                            row.projectNo ? 'border-gray-200 text-gray-700' : 'border-amber-300 bg-amber-50/60 text-gray-400',
                          )}
                        >
                          <option value="">请选择</option>
                          {projectOptions.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </Td>
                      <Td>
                        <DatePickerField
                          value={row.deadline}
                          onChange={(d) => updateRow(row.id, { deadline: d })}
                          placeholder="选择日期"
                          className="w-32 rounded-md px-2 py-1 text-xs"
                        />
                      </Td>
                      <Td>
                        <div className="flex flex-col items-center gap-1.5">
                          {row.files.length > 0 && (
                            <div className="flex max-w-64 flex-wrap items-center justify-center gap-1">
                              {row.files.map((f) => (
                                <span
                                  key={f.name}
                                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-teal-50/70 px-2 py-0.5 text-[11px] text-teal-700 ring-1 ring-teal-100"
                                  title={`${f.name}（${f.size}）`}
                                >
                                  <FileTypeIcon kind={f.kind as 'pdf'} />
                                  <span className="max-w-36 truncate">{f.name}</span>
                                  <button
                                    type="button"
                                    title="移除"
                                    onClick={() => removeFile(row.id, f.name)}
                                    className="text-teal-300 transition-colors hover:text-red-400"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => pickLocal(row.id)}
                              className="inline-flex items-center gap-1 text-xs text-teal-600 transition-colors hover:text-teal-700 hover:underline"
                            >
                              <Upload className="h-3.5 w-3.5" /> 本地上传
                            </button>
                            <button
                              type="button"
                              onClick={() => openTmfPicker(row.id)}
                              className="inline-flex items-center gap-1 text-xs text-teal-600 transition-colors hover:text-teal-700 hover:underline"
                            >
                              <FolderTree className="h-3.5 w-3.5" /> 从 STUDY TMF 选择
                            </button>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <button
                          type="button"
                          title={rows.length <= 1 ? '至少保留 1 行' : '删除该行'}
                          onClick={() => removeRow(row.id)}
                          className="text-gray-300 transition-colors hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          </div>
        </div>

        {/* 底部固定操作：取消 / 提交（全部行校验后一次性创建并发布） */}
        <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-5 py-4">
          <span className="text-xs text-gray-400">提交后全部行一次性创建并发布，递交概况矩阵即时同步</span>
          <span className="ml-auto" />
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" className="gap-1 bg-teal-500 text-white hover:bg-teal-600" onClick={submit}>
            <Send className="h-3.5 w-3.5" /> 提交
          </Button>
        </div>

        {/* 行内本地上传（多选） */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const id = pickRowRef.current
            if (id && e.target.files) {
              addFilesToRow(id, Array.from(e.target.files).map((f) => ({ name: f.name, size: fmtSize(f.size), kind: 'pdf' })))
            }
            e.target.value = ''
          }}
        />

        {/* 行内 STUDY TMF 选择（嵌套弹窗）：左目录右文件勾选 */}
        <Dialog open={!!tmfRowId} onOpenChange={(o) => !o && setTmfRowId(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogTitle className="text-base">从 STUDY TMF 选择</DialogTitle>
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-2">
                {studyCatalogs.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCatalog(c)
                      setTmfSel(new Set())
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
                          checked={tmfSel.has(f.id)}
                          onChange={(e) =>
                            setTmfSel((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(f.id)
                              else next.delete(f.id)
                              return next
                            })
                          }
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
                {catalog ? `当前目录：${catalog.name}，已选 ${tmfSel.size} 个文件` : '仅显示已归档（审批通过）的文件'}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setTmfRowId(null)}>
                  取消
                </Button>
                <Button size="sm" className="gap-1 bg-teal-500 hover:bg-teal-600" onClick={confirmTmf}>
                  确认引入{tmfSel.size > 0 && `（${tmfSel.size}）`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
