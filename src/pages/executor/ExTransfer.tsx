import { useMemo, useState } from 'react'
import { Plus, Trash2, Upload, RotateCcw, CircleX, FileX2, ArrowLeft, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageCard, DataTable, Th, Td, NameTd, Tr, FileTypeIcon, TealLink, FavButton } from '@/components/common'
import UploadDialog from '@/components/UploadDialog'
import SmartProcessDialog, { type SmartMode } from '@/components/SmartProcessDialog'
import { useStore, statsByCenter, nextId, todayStr, craOfCenter, EXECUTOR_NAME, EXECUTOR_CENTER, PM_USER, type TmfFile } from '@/store'

/* 执行人员 Transfer：上传 → 提交 → PM 审核；驳回可查看原因并重新上传 */
export default function ExTransfer() {
  const { state, dispatch } = useStore()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [rejectView, setRejectView] = useState<TmfFile | null>(null)
  const [folderView, setFolderView] = useState<TmfFile | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [smart, setSmart] = useState<{ file: TmfFile; mode: SmartMode } | null>(null)
  /* 删除模式：勾选要删除的行，可取消 */
  const [deleteMode, setDeleteMode] = useState(false)
  const [deleteSel, setDeleteSel] = useState<Set<string>>(new Set())

  // 执行端只看自己的文件
  const myFiles = useMemo(() => state.files.filter((f) => f.uploader === EXECUTOR_NAME), [state.files])
  // 全局项目筛选：无本页下拉，静默跟随顶部 Header（'全部' 不过滤）
  const project = state.activeProject
  const matchProject = (projectNo: string) => project === '全部' || projectNo.startsWith(project)
  // 上传列表：待提交 / 审核中 / 已驳回（归档后消失）；文件夹子文件不重复出现在顶层；随全局项目筛选
  const listFiles = useMemo(
    () => myFiles.filter((f) => f.status !== 'archived' && !f.parentId && matchProject(f.projectNo)),
    [myFiles, project],
  )
  // 文件夹钻取视图内的子文件
  const folderChildren = useMemo(
    () => (folderView ? myFiles.filter((f) => f.parentId === folderView.id) : []),
    [myFiles, folderView],
  )
  const stats = useMemo(() => statsByCenter(myFiles.filter((f) => matchProject(f.projectNo))), [myFiles, project])

  const submit = (f: TmfFile) => {
    dispatch({ type: 'submitFiles', ids: [f.id] })
    toast.success('已提交，等待项目经理审核', { description: f.name })
  }

  const reupload = (f: TmfFile) => {
    dispatch({ type: 'reuploadFile', id: f.id })
    toast.success('已重新上传，请再次提交审核')
  }

  const addRow = () => {
    const file: TmfFile = {
      id: nextId('f'),
      name: '新建文件夹',
      kind: 'folder',
      projectNo: 'ON101CL103',
      center: EXECUTOR_CENTER,
      uploader: EXECUTOR_NAME,
      uploadDate: todayStr(),
      size: '0KB',
      status: 'uploaded',
    }
    dispatch({ type: 'addFiles', files: [file] })
    /* 新建后立即进入命名状态 */
    setRenamingId(file.id)
    setRenameText(file.name)
  }

  const commitRename = () => {
    if (renamingId && renameText.trim()) {
      dispatch({ type: 'renameFile', id: renamingId, name: renameText.trim() })
    }
    setRenamingId(null)
  }

  /* 删除模式：进入/勾选/取消/确认删除（文件夹子文件级联删除） */
  const enterDelete = () => {
    setDeleteMode(true)
    setDeleteSel(new Set())
  }
  const exitDelete = () => {
    setDeleteMode(false)
    setDeleteSel(new Set())
  }
  const toggleDel = (id: string, checked: boolean) => {
    setDeleteSel((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }
  const confirmDelete = () => {
    if (deleteSel.size === 0) {
      toast.warning('请先勾选要删除的文件/文件夹')
      return
    }
    const n = deleteSel.size
    dispatch({ type: 'removeFiles', ids: [...deleteSel] })
    toast.success(`已删除 ${n} 项`, { description: '如包含文件夹，其内子文件已一并删除' })
    exitDelete()
  }

  /* 删除模式作用列表：文件夹钻取视图内为子文件，否则为顶层列表 */
  const currentList = folderView ? folderChildren : listFiles
  const toggleSelectAll = () =>
    setDeleteSel((prev) =>
      prev.size === currentList.length && currentList.length > 0
        ? new Set()
        : new Set(currentList.map((f) => f.id)),
    )

  return (
    <div className="space-y-5">
      {/* 传输概况（从 store 派生） */}
      <PageCard title="传输概况">
        <DataTable>
          <thead>
            <tr>
              <Th sortable={false}>研究中心</Th>
              <Th sortable={false}>临床监查员</Th>
              <Th sortable={false}>上传</Th>
              <Th sortable={false}>待审批</Th>
              <Th sortable={false}>驳回</Th>
              <Th sortable={false}>归档</Th>
            </tr>
          </thead>
          <tbody>
            {stats.map((r) => (
              <Tr key={r.center}>
                <Td>{r.center}</Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-[11px] font-medium text-teal-600">
                      {craOfCenter(state.craMap, r.center).slice(0, 1)}
                    </span>
                    {craOfCenter(state.craMap, r.center)}
                  </span>
                </Td>
                <Td>{r.uploaded}</Td>
                <Td>{r.pending}</Td>
                <Td>{r.rejected}</Td>
                <Td>{r.archived}</Td>
              </Tr>
            ))}
            {stats.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-gray-400">
                  暂无传输数据
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </PageCard>

      {/* 文件上传列表 / 文件夹钻取视图 */}
      <PageCard
        title={
          folderView ? (
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  exitDelete()
                  setFolderView(null)
                }}
                className="flex items-center gap-1 text-xs font-normal text-gray-400 transition-colors hover:text-teal-600"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> 返回
              </button>
              <span className="text-gray-300">|</span>
              <span>文件上传 / {folderView.name}</span>
            </span>
          ) : (
            '文件上传'
          )
        }
        extra={
          deleteMode ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={toggleSelectAll}>
                {deleteSel.size === currentList.length && currentList.length > 0 ? '清空' : '全选'}
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exitDelete}>
                取消
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1 bg-red-500 text-xs text-white hover:bg-red-600"
                onClick={confirmDelete}
              >
                <Trash2 className="h-3.5 w-3.5" /> 确认删除{deleteSel.size > 0 ? `（${deleteSel.size}）` : ''}
              </Button>
            </div>
          ) : folderView ? (
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={enterDelete}>
              <Trash2 className="h-3.5 w-3.5" /> 删除
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addRow}>
                <Plus className="h-3.5 w-3.5" /> 新建
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={enterDelete}>
                <Trash2 className="h-3.5 w-3.5" /> 删除
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setUploadOpen(true)}>
                <Upload className="h-3.5 w-3.5" /> 上传
              </Button>
            </div>
          )
        }
      >
        <DataTable>
          <thead>
            <tr>
              {deleteMode && <Th sortable={false}>选择</Th>}
              <Th sortable={false}>文件名称</Th>
              <Th>上传日期</Th>
              <Th>文件大小</Th>
              <Th>项目编号</Th>
              <Th sortable={false}>智能处理</Th>
              <Th sortable={false}>状态</Th>
            </tr>
          </thead>
          <tbody>
            {(folderView ? folderChildren : listFiles).map((f) => (
              <Tr key={f.id}>
                {deleteMode && (
                  <Td>
                    <input
                      type="checkbox"
                      checked={deleteSel.has(f.id)}
                      onChange={(e) => toggleDel(f.id, e.target.checked)}
                      className="h-4 w-4 accent-teal-600"
                    />
                  </Td>
                )}
                <NameTd aside={f.kind !== 'folder' ? <FavButton id={f.id} /> : undefined}>
                  {renamingId === f.id ? (
                    <input
                      autoFocus
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename()
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      className="w-48 rounded-md border border-teal-300 px-2 py-1 text-sm text-gray-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  ) : (
                    <span className="flex items-center gap-2.5">
                      <FileTypeIcon kind={f.kind} />
                      {f.kind === 'folder' && !folderView ? (
                        <button
                          type="button"
                          onClick={() => (deleteMode ? toggleDel(f.id, !deleteSel.has(f.id)) : setFolderView(f))}
                          className="text-gray-700 underline decoration-gray-300 decoration-dotted underline-offset-4 transition-colors hover:text-teal-600"
                        >
                          {f.name}
                        </button>
                      ) : (
                        <span className="text-gray-700">{f.name}</span>
                      )}
                      {f.kind === 'folder' && (
                        <button
                          type="button"
                          title="重命名"
                          onClick={() => {
                            setRenamingId(f.id)
                            setRenameText(f.name)
                          }}
                          className="text-gray-300 transition-colors hover:text-teal-500"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  )}
                </NameTd>
                <Td>{f.uploadDate}</Td>
                <Td>{f.size}</Td>
                <Td>
                  <span className="inline-flex rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-100">
                    {f.projectNo}
                  </span>
                </Td>
                <Td>
                  {f.kind === 'folder' ? (
                    <span className="text-xs text-gray-300">—</span>
                  ) : (
                    <span className="flex items-center gap-4">
                      <TealLink onClick={() => setSmart({ file: f, mode: 'rename' })}>智能命名</TealLink>
                      <TealLink onClick={() => setSmart({ file: f, mode: 'correct' })}>智能纠错</TealLink>
                    </span>
                  )}
                </Td>
                <Td>
                  {f.status === 'uploaded' && (
                    <button
                      type="button"
                      onClick={() => submit(f)}
                      className="inline-flex items-center rounded-md bg-teal-500 px-3 py-1.5 text-xs text-white transition-colors hover:bg-teal-600"
                    >
                      提交
                    </button>
                  )}
                  {f.status === 'pending' && (
                    <span className="inline-flex cursor-not-allowed items-center rounded-md bg-gray-100 px-3 py-1.5 text-xs text-gray-400">
                      审核中
                    </span>
                  )}
                  {f.status === 'rejected' && (
                    <button
                      type="button"
                      onClick={() => setRejectView(f)}
                      title="点击查看驳回原因"
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-100"
                    >
                      <CircleX className="h-3 w-3" /> 驳回
                    </button>
                  )}
                </Td>
              </Tr>
            ))}
            {(folderView ? folderChildren : listFiles).length === 0 && (
              <tr>
                <td colSpan={deleteMode ? 7 : 6} className="py-12 text-center text-sm text-gray-400">
                  {folderView ? '文件夹内暂无文件' : '暂无文件，点击右上角"上传"添加文件'}
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </PageCard>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <SmartProcessDialog target={smart} onClose={() => setSmart(null)} />

      {/* 驳回原因弹窗 */}
      <Dialog open={!!rejectView} onOpenChange={(o) => !o && setRejectView(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileX2 className="h-5 w-5 text-red-500" /> 驳回原因
            </DialogTitle>
          </DialogHeader>
          {rejectView && (
            <div className="space-y-4 py-1">
              <div className="flex items-center gap-2.5 rounded-lg bg-gray-50 px-3.5 py-2.5">
                <FileTypeIcon kind={rejectView.kind} />
                <span className="text-sm text-gray-700">{rejectView.name}</span>
              </div>
              <div className="rounded-lg border border-red-100 bg-red-50/60 px-3.5 py-3">
                <div className="mb-1 text-xs text-gray-400">
                  审核人：{PM_USER.name}（{PM_USER.title}）
                </div>
                <p className="text-sm leading-relaxed text-red-600">{rejectView.reason}</p>
              </div>
              <p className="text-xs text-gray-400">请按驳回原因更新文件后重新上传，并再次提交审核。</p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectView(null)}>
              关闭
            </Button>
            <Button
              size="sm"
              className="gap-1 bg-teal-500 hover:bg-teal-600"
              onClick={() => {
                if (rejectView) reupload(rejectView)
                setRejectView(null)
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> 重新上传
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
