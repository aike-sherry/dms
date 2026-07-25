import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, FolderCog, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageCard, DataTable, Th, Td, NameTd, Tr, FileTypeIcon, TealLink, FavButton, ToolbarSelect } from '@/components/common'
import UploadDialog from '@/components/UploadDialog'
import SmartProcessDialog, { type SmartMode } from '@/components/SmartProcessDialog'
import { useStore, statsByProject, nextId, todayStr, fmtSize, PM_USER, EXECUTOR_CENTER, type TmfFile } from '@/store'

/* PM Transfer：上传跳过审核可直接归档（归档至对应项目编号的 STUDY TMF 目录）；
   支持新建文件夹 → 命名 → 打开 → 从本地上传文件到文件夹内 */
export default function Transfer() {
  const { state, dispatch } = useStore()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [openFolder, setOpenFolder] = useState<TmfFile | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [smart, setSmart] = useState<{ file: TmfFile; mode: SmartMode } | null>(null)
  /* 删除模式：勾选要删除的行，可取消 */
  const [deleteMode, setDeleteMode] = useState(false)
  const [deleteSel, setDeleteSel] = useState<Set<string>>(new Set())
  /* 文件夹项目编号更换 */
  const [projPicker, setProjPicker] = useState<TmfFile | null>(null)
  const [projDraft, setProjDraft] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const myFiles = useMemo(() => state.files.filter((f) => f.uploader === PM_USER.name), [state.files])
  /* 全局项目筛选：无本页下拉，静默跟随顶部 Header（'全部' 不过滤） */
  const project = state.activeProject
  const matchProject = (projectNo: string) => project === '全部' || projectNo.startsWith(project)
  /* 项目编号选项：动态取自 STUDY TMF 目录 */
  const projectChoices = useMemo(
    () => [...new Set(state.catalogs.filter((c) => c.kind === 'study').map((c) => c.projectNo))],
    [state.catalogs],
  )
  /* 新建文件夹的默认项目编号：取第一个 STUDY TMF 目录 */
  const defaultProjectNo = projectChoices[0] ?? 'ON101CL103'
  /* 顶层列表：不含文件夹内的子文件，随全局项目筛选 */
  const topFiles = useMemo(
    () => myFiles.filter((f) => f.status !== 'archived' && !f.parentId && matchProject(f.projectNo)),
    [myFiles, project],
  )
  const stats = useMemo(() => statsByProject(myFiles.filter((f) => matchProject(f.projectNo))), [myFiles, project])

  /* 当前文件夹内的子文件 */
  const childFiles = useMemo(
    () => (openFolder ? myFiles.filter((f) => f.parentId === openFolder.id && f.status !== 'archived') : []),
    [myFiles, openFolder],
  )

  const archive = (f: TmfFile) => {
    const childCount = f.kind === 'folder' ? myFiles.filter((x) => x.parentId === f.id).length : 0
    dispatch({ type: 'archiveFile', id: f.id })
    toast.success('归档成功', {
      description:
        childCount > 0
          ? `文件夹「${f.name}」及 ${childCount} 个子文件已归档至 ${f.projectNo} 的 STUDY TMF 文件夹`
          : `${f.name} 已归档至 ${f.projectNo} 的 STUDY TMF 文件夹`,
    })
  }

  const addFolder = () => {
    const file: TmfFile = {
      id: nextId('f'),
      name: '新建文件夹',
      kind: 'folder',
      projectNo: defaultProjectNo,
      center: EXECUTOR_CENTER,
      uploader: PM_USER.name,
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
  const currentList = openFolder ? childFiles : topFiles
  const toggleSelectAll = () =>
    setDeleteSel((prev) =>
      prev.size === currentList.length && currentList.length > 0
        ? new Set()
        : new Set(currentList.map((f) => f.id)),
    )

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

  /* 从本地电脑上传文件到当前文件夹（继承文件夹的项目编号，归档时跟随） */
  const importLocal = (fileList: FileList | null) => {
    if (!fileList || !openFolder) return
    const files: TmfFile[] = [...fileList].map((fl) => ({
      id: nextId('f'),
      name: fl.name.replace(/\.[^.]+$/, ''),
      kind: 'pdf' as const,
      projectNo: openFolder.projectNo,
      center: openFolder.center,
      uploader: PM_USER.name,
      uploadDate: todayStr(),
      size: fmtSize(fl.size),
      status: 'uploaded' as const,
      parentId: openFolder.id,
    }))
    dispatch({ type: 'addFiles', files })
    toast.success(`已上传 ${files.length} 个文件至「${openFolder.name}」`, {
      description: `项目编号：${openFolder.projectNo}`,
    })
  }

  /* 文件名称单元格：文件夹可点击打开 / 重命名态显示输入框 */
  const nameCell = (f: TmfFile) => {
    if (renamingId === f.id) {
      return (
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
      )
    }
    return (
      <span className="flex items-center justify-center gap-2.5">
        <FileTypeIcon kind={f.kind} />
        {f.kind === 'folder' ? (
          <button
            type="button"
            onClick={() => (deleteMode ? toggleDel(f.id, !deleteSel.has(f.id)) : setOpenFolder(f))}
            title={deleteMode ? '点击勾选/取消' : '点击打开文件夹'}
            className="text-gray-700 underline decoration-teal-300 decoration-dotted underline-offset-4 transition-colors hover:text-teal-600"
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
    )
  }

  /* 文件与文件夹均可归档：文件夹级联归档其全部子文件 */
  const statusCell = (f: TmfFile) => (
    <button
      type="button"
      onClick={() => archive(f)}
      title={
        f.kind === 'folder'
          ? `文件夹整体归档至 ${f.projectNo} 的 STUDY TMF 文件夹`
          : `归档至 ${f.projectNo} 的 STUDY TMF 文件夹`
      }
      className="inline-flex items-center rounded-md bg-teal-500 px-3 py-1.5 text-xs text-white transition-colors hover:bg-teal-600"
    >
      归档
    </button>
  )

  /* 项目编号徽标：醒目标示归档归属；文件夹可点击更换编号 */
  const projectCell = (f: TmfFile) =>
    f.kind === 'folder' ? (
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
    )

  const fileTable = (rows: TmfFile[]) => (
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
        {rows.map((f) => (
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
            <NameTd aside={f.kind !== 'folder' ? <FavButton id={f.id} /> : undefined}>{nameCell(f)}</NameTd>
            <Td>{f.uploadDate}</Td>
            <Td>{f.size}</Td>
            <Td>{projectCell(f)}</Td>
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
            <Td>{statusCell(f)}</Td>
          </Tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={deleteMode ? 7 : 6} className="py-12 text-center text-sm text-gray-400">
              {openFolder ? '文件夹内暂无文件，点击右上角"上传"从本地导入' : '暂无文件，点击右上角"上传"添加文件'}
            </td>
          </tr>
        )}
      </tbody>
    </DataTable>
  )

  return (
    <div className="space-y-5">
      <PageCard title="文件状态">
        <DataTable>
          <thead>
            <tr>
              <Th sortable={false}>项目编号</Th>
              <Th sortable={false}>已上传</Th>
              <Th sortable={false}>归档</Th>
            </tr>
          </thead>
          <tbody>
            {stats.map((r) => (
              <Tr key={r.project}>
                <Td>{r.project}</Td>
                <Td>{r.uploaded}</Td>
                <Td>{r.archived}</Td>
              </Tr>
            ))}
            {stats.length === 0 && (
              <tr>
                <td colSpan={3} className="py-10 text-center text-sm text-gray-400">
                  暂无传输数据
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </PageCard>

      <PageCard
        title={
          openFolder ? (
            <span className="flex items-center gap-2 text-[15px] font-semibold text-gray-800">
              <button
                type="button"
                onClick={() => {
                  exitDelete()
                  setOpenFolder(null)
                }}
                className="flex items-center gap-1 text-sm font-normal text-gray-400 transition-colors hover:text-teal-600"
              >
                <ArrowLeft className="h-4 w-4" /> 返回
              </button>
              <span className="text-gray-300">|</span>
              文件上传 / {openFolder.name}
            </span>
          ) : (
            '文件上传'
          )
        }
        extra={
          <div className="flex items-center gap-2">
            {deleteMode ? (
              <>
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
              </>
            ) : openFolder ? (
              <>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={enterDelete}>
                  <Trash2 className="h-3.5 w-3.5" /> 删除
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> 上传
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addFolder}>
                  <Plus className="h-3.5 w-3.5" /> 新建
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={enterDelete}>
                  <Trash2 className="h-3.5 w-3.5" /> 删除
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-3.5 w-3.5" /> 上传
                </Button>
              </>
            )}
          </div>
        }
      >
        {openFolder ? fileTable(childFiles) : fileTable(topFiles)}
      </PageCard>

      {/* 文件夹内上传：来源为个人电脑本地文件 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          importLocal(e.target.files)
          e.target.value = ''
        }}
      />

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} uploader={PM_USER.name} />
      <SmartProcessDialog target={smart} onClose={() => setSmart(null)} />

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
    </div>
  )
}
