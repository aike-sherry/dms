import { useMemo, useState } from 'react'
import { Plus, Trash2, Upload, RotateCcw, CircleX, FileX2, ArrowLeft, Pencil, FolderCog } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageCard, DataTable, Th, Td, NameTd, NameTh, Tr, FileTypeIcon, TealLink, FavButton, ToolbarSelect } from '@/components/common'
import { VersionHist } from '@/components/VersionHist'
import UploadDialog from '@/components/UploadDialog'
import SmartProcessDialog, { type SmartMode } from '@/components/SmartProcessDialog'
import { useStore, statsByCenter, nextId, todayStr, craNameOf, EXECUTOR_NAME, EXECUTOR_CENTER, PM_USER, type TmfFile } from '@/store'

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
  /* 新建文件夹弹窗：名称 + 所属项目编号（默认全局筛选值，'全部' 时取第一个项目） */
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderProject, setNewFolderProject] = useState('')
  /* 文件夹项目编号更换 */
  const [projPicker, setProjPicker] = useState<TmfFile | null>(null)
  const [projDraft, setProjDraft] = useState('')
  /* 钻取视图内上传：项目编号锁定继承文件夹所属项目 */
  const [folderUploadOpen, setFolderUploadOpen] = useState(false)

  // 执行端只看自己的文件
  const myFiles = useMemo(() => state.files.filter((f) => f.uploader === EXECUTOR_NAME), [state.files])
  // 全局项目筛选：无本页下拉，静默跟随顶部 Header（'全部' 不过滤）
  const project = state.activeProject
  const matchProject = (projectNo: string) => project === '全部' || projectNo.startsWith(project)
  /* 项目编号选项：动态取自 STUDY TMF 目录 */
  const projectChoices = useMemo(
    () => [...new Set(state.catalogs.filter((c) => c.kind === 'study').map((c) => c.projectNo))],
    [state.catalogs],
  )
  /* 新建文件夹默认项目编号：全局筛选为具体项目时跟随筛选（前缀匹配），'全部' 时取第一个项目 */
  const defaultNewFolderProject = () =>
    (project !== '全部' ? projectChoices.find((p) => p.startsWith(project)) : undefined) ?? projectChoices[0] ?? ''
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

  /* 新建文件夹：弹窗内输入名称并选择所属项目编号（默认全局筛选值） */
  const openNewFolder = () => {
    setNewFolderName('新建文件夹')
    setNewFolderProject(defaultNewFolderProject())
    setNewFolderOpen(true)
  }
  const confirmNewFolder = () => {
    if (!newFolderProject) {
      toast.warning('请选择所属项目编号', { description: '文件夹归档时按项目编号进入对应 STUDY TMF' })
      return
    }
    const file: TmfFile = {
      id: nextId('f'),
      name: newFolderName.trim() || '新建文件夹',
      kind: 'folder',
      projectNo: newFolderProject,
      center: EXECUTOR_CENTER,
      uploader: EXECUTOR_NAME,
      uploadDate: todayStr(),
      size: '0KB',
      status: 'uploaded',
    }
    dispatch({ type: 'addFiles', files: [file] })
    toast.success(`已创建文件夹「${file.name}」`, { description: `项目编号：${file.projectNo}，可打开后在内上传文件` })
    setNewFolderOpen(false)
  }

  /* 文件夹更换项目编号（级联子文件） */
  const openProjPicker = (f: TmfFile) => {
    setProjPicker(f)
    setProjDraft(f.projectNo)
  }
  const confirmProjChange = () => {
    if (!projPicker || !projDraft) return
    dispatch({ type: 'setFileProject', id: projPicker.id, projectNo: projDraft })
    toast.success('项目编号已更新', {
      description: `文件夹「${projPicker.name}」及子文件的编号已更新为 ${projDraft}，归档时将进入该项目 STUDY TMF`,
    })
    setProjPicker(null)
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
            {stats.map((r) => {
              /* R32：CRA 列改读研究中心注册表；未配置显示 — */
              const cra = craNameOf(state.centers, r.center)
              return (
              <Tr key={r.center}>
                <Td>{r.center}</Td>
                <Td>
                  {cra ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-[11px] font-medium text-teal-600">
                        {cra.slice(0, 1)}
                      </span>
                      {cra}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </Td>
                <Td>{r.uploaded}</Td>
                <Td>{r.pending}</Td>
                <Td>{r.rejected}</Td>
                <Td>{r.archived}</Td>
              </Tr>
              )
            })}
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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={enterDelete}>
                <Trash2 className="h-3.5 w-3.5" /> 删除
              </Button>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setFolderUploadOpen(true)}>
                <Upload className="h-3.5 w-3.5" /> 上传
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={openNewFolder}>
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
              {deleteMode && <Th sortable={false} className="w-12">选择</Th>}
              <NameTh className="w-[26%]">文件名称</NameTh>
              <Th className="w-36">上传日期</Th>
              <Th className="w-28">文件大小</Th>
              <Th className="w-40">项目编号</Th>
              <Th sortable={false} className="w-52">智能处理</Th>
              <Th sortable={false} className="w-28">状态</Th>
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
                      className="w-48 rounded-md border border-teal-300 px-2 py-1 text-center text-sm text-gray-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
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
                        <span className="truncate text-gray-700">{f.name}</span>
                      )}
                      <VersionHist file={f} />
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
                  {f.kind === 'folder' ? (
                    /* 文件夹编号徽标可点击更换（子文件级联更新） */
                    <button
                      type="button"
                      title="点击更换项目编号"
                      onClick={() => openProjPicker(f)}
                      className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-100 transition-colors hover:bg-teal-100"
                    >
                      {f.projectNo}
                      <FolderCog className="h-3 w-3 text-teal-400" />
                    </button>
                  ) : (
                    <span className="inline-flex rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-100">
                      {f.projectNo}
                    </span>
                  )}
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
                  {folderView ? '文件夹内暂无文件，点击右上角"上传"添加文件' : '暂无文件，点击右上角"上传"添加文件'}
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </PageCard>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} withNamingConfirm />
      {/* 钻取视图内上传：项目编号锁定继承文件夹所属项目，文件挂为该文件夹子级 */}
      <UploadDialog
        open={folderUploadOpen && !!folderView}
        onOpenChange={setFolderUploadOpen}
        withNamingConfirm
        lockProjectNo={folderView?.projectNo}
        fixedParentId={folderView?.id}
      />
      <SmartProcessDialog target={smart} onClose={() => setSmart(null)} />

      {/* 新建文件夹弹窗：名称 + 所属项目编号（默认全局筛选值，'全部' 时取第一个项目） */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <Plus className="h-4 w-4 text-teal-600" /> 新建文件夹
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">文件夹名称</label>
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmNewFolder()}
                placeholder="新建文件夹"
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 outline-none hover:border-teal-400 focus:border-teal-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">所属项目编号（归档目标 STUDY TMF）</label>
              <ToolbarSelect
                value={newFolderProject}
                onChange={setNewFolderProject}
                options={projectChoices.map((p) => ({ label: p, value: p }))}
                className="w-full [&>select]:w-full"
              />
              <p className="text-xs text-gray-400">创建后可点击列表中的编号徽标随时更换，子文件编号同步更新</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(false)}>
                取消
              </Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={confirmNewFolder}>
                创建
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 文件夹项目编号更换弹窗 */}
      <Dialog open={!!projPicker} onOpenChange={(o) => !o && setProjPicker(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <FolderCog className="h-4 w-4 text-teal-600" /> 更换项目编号
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
              {projPicker && <FileTypeIcon kind={projPicker.kind} />}
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-700">{projPicker?.name}</p>
                <p className="text-xs text-gray-400">当前编号：{projPicker?.projectNo}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">归属项目编号（归档目标 STUDY TMF）</label>
              <ToolbarSelect
                value={projDraft}
                onChange={setProjDraft}
                options={projectChoices.map((p) => ({ label: p, value: p }))}
                className="w-full [&>select]:w-full"
              />
              <p className="text-xs text-gray-400">更换后文件夹内子文件的编号将同步更新</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setProjPicker(null)}>
                取消
              </Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={confirmProjChange}>
                确认更换
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
