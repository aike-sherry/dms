import { Fragment, useEffect, useMemo, useState } from 'react'
import { Plus, Download, ChevronRight, Upload, Pencil, Braces, History } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  PageCard,
  DataTable,
  Th,
  Td,
  NameTd,
  NameTh,
  Tr,
  ToolbarSelect,
  SearchInput,
  FileTypeIcon,
  StatusPill,
  TealLink,
  FavButton,
  ModalHeader,
} from '@/components/common'
import CatalogDialog from '@/components/CatalogDialog'
import TmfUploadDialog from '@/components/TmfUploadDialog'
import { SkeletonText } from '@/pages/admin/AdminNaming'
import { effectiveTemplateRef } from '@/lib/namingSkeleton'
import { projectOptions } from '@/data/mock'
import { useStore, craNameOf, displayNameOf, PM_USER, type Catalog, type TmfFile } from '@/store'

/* R39 文件夹行命名骨架徽标：本目录绑定=teal「骨架·xx」；上级继承=灰「继承·xx」（title 提示继承来源） */
function FolderTemplateBadge({ folderId }: { folderId: string }) {
  const { state } = useStore()
  const eff = effectiveTemplateRef(state.files, folderId, state.namingTemplates)
  if (!eff) return null
  if (eff.inherited) {
    return (
      <span
        title={`继承自：${eff.holder.name}`}
        className="shrink-0 cursor-help rounded-full bg-gray-100 px-2 py-0.5 text-[11px] whitespace-nowrap text-gray-400 ring-1 ring-gray-200"
      >
        继承·{eff.template.name}
      </span>
    )
  }
  return (
    <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] whitespace-nowrap text-teal-600 ring-1 ring-teal-100">
      骨架·{eff.template.name}
    </span>
  )
}

export default function TmfPage({ type }: { type: 'study' | 'site' }) {
  const { state, dispatch } = useStore()
  const isStudy = type === 'study'
  const label = isStudy ? 'STUDY TMF' : 'SITE TMF'

  const [search, setSearch] = useState('')
  /* 全局项目筛选：与顶部 Header 下拉联动；STUDY 页无下拉，静默跟随全局 */
  const project = state.activeProject
  const setProject = (p: string) => dispatch({ type: 'setActiveProject', project: p })
  const [dialogOpen, setDialogOpen] = useState(() => window.location.hash.includes('newdir'))
  const [detail, setDetail] = useState<Catalog | null>(() => {
    const m = window.location.hash.match(/drill=([\w-]+)/)
    return state.catalogs.find((c) => c.id === m?.[1] && c.kind === type) ?? null
  })
  /* 钻取视图内逐级打开已归档文件夹（分区 → 文档类型 → 文件，栈式路径） */
  const [folderStack, setFolderStack] = useState<TmfFile[]>([])
  const currentFolder = folderStack[folderStack.length - 1] ?? null
  /* 钻取视图上传弹窗（任意层级可直接上传到当前层级，直接归档） */
  const [uploadOpen, setUploadOpen] = useState(false)
  /* R39 文件夹绑定命名骨架：钻取表文件夹行「绑定骨架」弹窗；bindSel='' 表示不绑定 */
  const [bindFolder, setBindFolder] = useState<TmfFile | null>(null)
  const [bindSel, setBindSel] = useState('')
  const openBind = (f: TmfFile) => {
    setBindFolder(f)
    setBindSel(f.namingTemplateId ?? '')
  }
  const saveBind = () => {
    if (!bindFolder) return
    const tpl = state.namingTemplates.find((t) => t.id === bindSel)
    dispatch({ type: 'setFolderTemplate', id: bindFolder.id, templateId: tpl ? tpl.id : null })
    toast.success(tpl ? `已绑定骨架「${tpl.name}」` : '已取消绑定', {
      description: '仅对后续上传的文件生效，存量文件名不会改变',
    })
    setBindFolder(null)
  }
  const unbind = () => {
    if (!bindFolder) return
    dispatch({ type: 'setFolderTemplate', id: bindFolder.id, templateId: null })
    toast.success('已解绑本目录骨架', { description: '后续上传将跟随上级目录的绑定（如有）；存量文件名不变' })
    setBindFolder(null)
  }
  /* R39 二阶段A：文件属性弹窗（展示名改名写审计 + 命名历史时间线） */
  const [attrFileId, setAttrFileId] = useState<string | null>(null)
  const [attrName, setAttrName] = useState('')
  const attrFile = attrFileId ? (state.files.find((f) => f.id === attrFileId) ?? null) : null
  const attrLogs = useMemo(
    () => (attrFileId ? state.namingLogs.filter((l) => l.fileId === attrFileId) : []),
    [state.namingLogs, attrFileId],
  )
  const openAttr = (f: TmfFile) => {
    setAttrFileId(f.id)
    setAttrName(displayNameOf(f))
  }
  const saveAttrName = () => {
    if (!attrFile) return
    const name = attrName.trim()
    if (!name) {
      toast.warning('展示名不能为空')
      return
    }
    if (name === displayNameOf(attrFile)) {
      setAttrFileId(null)
      return
    }
    dispatch({ type: 'renameDisplayFilename', id: attrFile.id, name, operator: PM_USER.name, role: 'pm' })
    toast.success('展示名已更新', { description: '原始文件名保持不变，本次修改已写入命名审计' })
    setAttrFileId(null)
  }
  /* R27 钻取列表文件夹行内重命名（含目录顶层文件夹行）：铅笔入口 → 行内输入框，回车/失焦保存、Esc 取消 */
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const commitRename = () => {
    const name = renameText.trim()
    if (renamingId && name) {
      const cur = state.files.find((f) => f.id === renamingId)
      const dup = state.files.some(
        (f) =>
          f.id !== renamingId &&
          f.kind === 'folder' &&
          f.folderId === cur?.folderId &&
          f.parentId === cur?.parentId &&
          f.name === name,
      )
      if (dup) {
        toast.warning('已存在同名文件夹', { description: '同级目录下文件夹名称不能重复，请换一个名称' })
        return
      }
      dispatch({ type: 'renameFile', id: renamingId, name })
      toast.success('文件夹已重命名')
    }
    setRenamingId(null)
  }
  /* R28 顶层目录行内重命名：目录列表文件夹行的铅笔入口；同名冲突（同类型同中心，跨项目也算）保持编辑态 */
  const [renamingCatId, setRenamingCatId] = useState<string | null>(null)
  const [catRenameText, setCatRenameText] = useState('')
  const commitCatRename = () => {
    const name = catRenameText.trim()
    if (renamingCatId && name) {
      const cur = state.catalogs.find((c) => c.id === renamingCatId)
      const dup = state.catalogs.some(
        (c) =>
          c.id !== renamingCatId &&
          c.kind === cur?.kind &&
          (c.center ?? '') === (cur?.center ?? '') &&
          c.name === name,
      )
      if (dup) {
        toast.warning('已存在同名目录', { description: '相同类型/中心下目录名称不能重复，请换一个名称' })
        return
      }
      dispatch({ type: 'renameCatalog', id: renamingCatId, name })
      toast.success('目录已重命名')
    }
    setRenamingCatId(null)
  }
  /* 下载选择模式：勾选文件夹后批量下载，可取消 */
  const [dlMode, setDlMode] = useState(false)
  const [dlSel, setDlSel] = useState<Set<string>>(new Set())
  /* R36 回归修复：STUDY/SITE 侧栏切换共用同一组件实例，type 变化时重置钻取与选择状态，
     避免残留另一类型目录的详情视图（面包屑标签与内容错位） */
  useEffect(() => {
    setDetail(null)
    setFolderStack([])
    setUploadOpen(false)
    setRenamingId(null)
    setRenamingCatId(null)
    setDlMode(false)
    setDlSel(new Set())
  }, [type])
  const enterDl = () => {
    setDlMode(true)
    setDlSel(new Set())
  }
  const exitDl = () => {
    setDlMode(false)
    setDlSel(new Set())
  }
  const toggleDl = (id: string) =>
    setDlSel((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const confirmDl = () => {
    toast.success(`已开始下载 ${dlSel.size} 个文件夹`)
    exitDl()
  }

  const catalogs = useMemo(
    () =>
      state.catalogs.filter(
        (c) =>
          c.kind === type &&
          (project === '全部' || c.projectNo.startsWith(project)) &&
          c.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [state.catalogs, type, search, project],
  )

  /* 管理统计卡：按项目编号（STUDY）/ 研究中心（SITE）从文件实时派生（随全局项目筛选）。
     口径：只统计 kind='file' 的具体文件（kind !== 'folder'），Excel 导入生成的空文件夹不计入任何状态列 */
  const manageRows = useMemo(() => {
    const matchProject = (projectNo: string) => project === '全部' || projectNo.startsWith(project)
    const catIds = new Set(state.catalogs.filter((c) => c.kind === type).map((c) => c.id))
    const keys = new Set<string>()
    for (const c of state.catalogs)
      if (c.kind === type && matchProject(c.projectNo)) keys.add(isStudy ? c.projectNo : (c.center ?? ''))
    for (const f of state.files)
      if (!f.parentId && f.kind !== 'folder' && matchProject(f.projectNo))
        keys.add(isStudy ? f.projectNo : f.center)
    return [...keys].filter(Boolean).map((key) => {
      const tops = state.files.filter(
        (f) =>
          !f.parentId &&
          f.kind !== 'folder' &&
          matchProject(f.projectNo) &&
          (isStudy ? f.projectNo : f.center) === key,
      )
      const archivedHere = state.files.filter(
        (f) =>
          f.kind !== 'folder' &&
          f.status === 'archived' &&
          f.folderId &&
          catIds.has(f.folderId) &&
          matchProject(f.projectNo) &&
          (isStudy ? f.projectNo : f.center) === key,
      )
      return {
        name: key,
        uploaded: tops.length,
        reviewing: tops.filter((f) => f.status === 'pending').length,
        approved: tops.filter((f) => f.status === 'archived').length,
        archived: archivedHere.length,
      }
    })
  }, [state.catalogs, state.files, type, isStudy, project])

  /* 钻取视图：文件夹内已归档文件（审核通过/直接归档进入；顶层条目，文件夹可继续打开） */
  const folderFiles = useMemo(
    () =>
      detail
        ? state.files.filter((f) => f.folderId === detail.id && f.status === 'archived' && !f.parentId)
        : [],
    [state.files, detail],
  )
  const childFiles = useMemo(
    () =>
      currentFolder ? state.files.filter((f) => f.parentId === currentFolder.id && f.status === 'archived') : [],
    [state.files, currentFolder],
  )

  /* 上传弹窗文档类型选项：同目录下的文件夹名（一级 + 当前层级兄弟 + 当前层级子级），当前文件夹名由弹窗并入 */
  const folderOptions = useMemo(() => {
    if (!detail) return []
    const tops = folderFiles.filter((f) => f.kind === 'folder')
    const siblings = currentFolder
      ? state.files.filter(
          (f) => f.kind === 'folder' && f.folderId === detail.id && f.parentId === currentFolder.parentId,
        )
      : []
    const children = (currentFolder ? childFiles : folderFiles).filter((f) => f.kind === 'folder')
    return [...new Set([...tops, ...siblings, ...children].map((f) => f.name))]
  }, [state.files, detail, folderFiles, childFiles, currentFolder])

  return (
    <div className="space-y-5">
      {/* 顶部管理统计卡片 */}
      <PageCard title={`${label} 管理`}>
        <DataTable>
          <thead>
            <tr>
              <Th sortable={false}>{isStudy ? '项目编号' : '研究中心'}</Th>
              {!isStudy && <Th sortable={false}>临床监查员</Th>}
              <Th sortable={false}>已上传</Th>
              <Th sortable={false}>审批中</Th>
              <Th sortable={false}>审批通过</Th>
              <Th sortable={false}>归档</Th>
            </tr>
          </thead>
          <tbody>
            {manageRows.map((r) => {
              /* R32：CRA 列改读研究中心注册表；未配置显示 — */
              const cra = isStudy ? '' : craNameOf(state.centers, r.name)
              return (
              <Tr key={r.name}>
                <Td>{r.name}</Td>
                {!isStudy && (
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
                )}
                <Td>{r.uploaded}</Td>
                <Td>{r.reviewing}</Td>
                <Td>{r.approved}</Td>
                <Td>{r.archived}</Td>
              </Tr>
              )
            })}
          </tbody>
        </DataTable>
      </PageCard>

      {/* 底部文件夹列表 / 二级视图 */}
      {detail === null ? (
        <PageCard
          bodyClassName="pt-0"
          className="pt-5"
          title={<span className="sr-only">{label}列表</span>}
          extra={
            <div className="flex flex-1 items-center justify-between">
              <div className="flex items-center gap-3">
                <SearchInput value={search} onChange={setSearch} className="w-56" />
                {!isStudy && (
                  <ToolbarSelect
                    value={project}
                    onChange={setProject}
                    options={[{ label: '全部', value: '全部' }, ...projectOptions]}
                  />
                )}
              </div>
              <div className="flex items-center gap-3">
                {dlMode ? (
                  <>
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      onClick={() =>
                        setDlSel(dlSel.size === catalogs.length ? new Set() : new Set(catalogs.map((c) => c.id)))
                      }
                    >
                      {dlSel.size === catalogs.length ? '取消全选' : '全选'}
                    </Button>
                    <Button variant="outline" className="gap-1.5" onClick={exitDl}>
                      取消
                    </Button>
                    <Button
                      className="gap-1.5 bg-teal-500 text-white hover:bg-teal-600"
                      disabled={dlSel.size === 0}
                      onClick={confirmDl}
                    >
                      <Download className="h-4 w-4" /> 确认下载（{dlSel.size}）
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" className="gap-1.5" onClick={enterDl}>
                      <Download className="h-4 w-4" /> 下载
                    </Button>
                    <Button
                      className="gap-1.5 bg-teal-500 text-white hover:bg-teal-600"
                      onClick={() => setDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4" /> 创建目录
                    </Button>
                  </>
                )}
              </div>
            </div>
          }
        >
          <DataTable>
            <thead>
              <tr>
                <NameTh className="w-[22%]">文件夹名称</NameTh>
                <Th className="w-36">项目编号</Th>
                <Th className="w-36">创建日期</Th>
                <Th className="w-32">创建人员</Th>
                <Th className="w-36">更新日期</Th>
                <Th className="w-28">文件大小</Th>
                <Th sortable={false} className="w-32">文件状态</Th>
              </tr>
            </thead>
            <tbody>
              {catalogs.map((c) => (
                <Tr
                  key={c.id}
                  onClick={() => {
                    if (dlMode) {
                      toggleDl(c.id)
                    } else {
                      setDetail(c)
                      setFolderStack([])
                    }
                  }}
                  className={dlMode && dlSel.has(c.id) ? 'bg-teal-50/60' : undefined}
                >
                  <NameTd>
                    {renamingCatId === c.id ? (
                      <input
                        autoFocus
                        value={catRenameText}
                        onChange={(e) => setCatRenameText(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={commitCatRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitCatRename()
                          if (e.key === 'Escape') setRenamingCatId(null)
                        }}
                        className="w-56 rounded-md border border-teal-300 px-2 py-1 text-center text-sm text-gray-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      />
                    ) : (
                      <span className="flex min-w-0 items-center gap-2.5">
                        {dlMode && (
                          <input
                            type="checkbox"
                            checked={dlSel.has(c.id)}
                            onChange={() => toggleDl(c.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 accent-teal-500"
                          />
                        )}
                        <FileTypeIcon kind="folder" />
                        <span className="truncate text-gray-700">{c.name}</span>
                        <button
                          type="button"
                          title="重命名"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRenamingCatId(c.id)
                            setCatRenameText(c.name)
                          }}
                          className="shrink-0 text-gray-300 transition-colors hover:text-teal-500"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
                  </NameTd>
                  <Td>{c.projectNo}</Td>
                  <Td>{c.createDate}</Td>
                  <Td>{c.creator}</Td>
                  <Td>{c.updateDate}</Td>
                  <Td>{c.size}</Td>
                  <Td>
                    <StatusPill status={c.status} />
                  </Td>
                </Tr>
              ))}
              {catalogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                    {state.catalogs.filter((c) => c.kind === type).length === 0 ? (
                      <div className="space-y-1.5">
                        <div>暂无目录</div>
                        <div className="text-xs text-gray-400">
                          点击右上角「创建目录」新建{type === 'site' ? '中心' : '项目'}目录；也可在弹窗列表中点「上传目录」，从
                          Excel 一键解析导入目录层级（无目录时会自动新建目标目录）
                        </div>
                      </div>
                    ) : (
                      '未找到匹配的文件夹'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </PageCard>
      ) : (
        <PageCard bodyClassName="pt-0" className="pt-5">
          {/* 面包屑返回 + 上传入口（钻取视图任意层级可直接上传到当前层级） */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5 text-sm">
              <button
                type="button"
                onClick={() => {
                  setDetail(null)
                  setFolderStack([])
                }}
                className="font-medium text-teal-600 transition-colors hover:text-teal-700 hover:underline"
              >
                {label}
              </button>
              <ChevronRight className="h-4 w-4 text-gray-300" />
              {folderStack.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setFolderStack([])}
                  className="flex items-center gap-2 text-teal-600 transition-colors hover:text-teal-700 hover:underline"
                >
                  <FileTypeIcon kind="folder" className="h-4 w-4" />
                  {detail.name}
                </button>
              ) : (
                <span className="flex items-center gap-2 text-gray-700">
                  <FileTypeIcon kind="folder" className="h-4 w-4" />
                  {detail.name}
                </span>
              )}
              {/* 逐级钻取路径：中间层级可点击回退 */}
              {folderStack.map((fo, i) => (
                <Fragment key={fo.id}>
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                  {i < folderStack.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setFolderStack((s) => s.slice(0, i + 1))}
                      className="flex items-center gap-2 text-teal-600 transition-colors hover:text-teal-700 hover:underline"
                    >
                      <FileTypeIcon kind="folder" className="h-4 w-4" />
                      {fo.name}
                    </button>
                  ) : (
                    <span className="flex items-center gap-2 text-gray-700">
                      <FileTypeIcon kind="folder" className="h-4 w-4" />
                      {fo.name}
                    </span>
                  )}
                </Fragment>
              ))}
            </div>
            <Button
              className="shrink-0 gap-1.5 bg-teal-500 text-white hover:bg-teal-600"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="h-4 w-4" /> 上传
            </Button>
          </div>

          <DataTable>
            <thead>
              <tr>
                <NameTh className="w-[18%]">文件名称</NameTh>
                <Th className="w-28">项目编号</Th>
                <Th className="w-36">更新人员</Th>
                <Th className="w-36">更新日期</Th>
                <Th className="w-28">文件大小</Th>
                <Th sortable={false} className="w-36">操作</Th>
              </tr>
            </thead>
            <tbody>
              {(currentFolder ? childFiles : folderFiles).map((f) => (
                <Tr key={f.id}>
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
                      <span className="flex min-w-0 items-center gap-2.5">
                        <FileTypeIcon kind={f.kind} />
                        {f.kind === 'folder' ? (
                          <button
                            type="button"
                            onClick={() => setFolderStack((s) => [...s, f])}
                            className="truncate text-gray-700 underline decoration-gray-300 decoration-dotted underline-offset-4 transition-colors hover:text-teal-600"
                          >
                            {f.name}
                          </button>
                        ) : (
                          <span className="truncate text-gray-700">{displayNameOf(f)}</span>
                        )}
                        {f.kind === 'folder' && (
                          <button
                            type="button"
                            title="重命名"
                            onClick={() => {
                              setRenamingId(f.id)
                              setRenameText(f.name)
                            }}
                            className="shrink-0 text-gray-300 transition-colors hover:text-teal-500"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {f.kind === 'folder' && <FolderTemplateBadge folderId={f.id} />}
                      </span>
                    )}
                  </NameTd>
                  <Td>{f.projectNo}</Td>
                  <Td>{f.uploader}</Td>
                  <Td>{f.uploadDate}</Td>
                  <Td>{f.size}</Td>
                  <Td>
                    {f.kind === 'folder' ? (
                      <TealLink onClick={() => openBind(f)}>绑定骨架</TealLink>
                    ) : (
                      <TealLink onClick={() => openAttr(f)}>属性</TealLink>
                    )}
                  </Td>
                </Tr>
              ))}
              {(currentFolder ? childFiles : folderFiles).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                    {currentFolder ? '该文件夹内暂无文件' : '该文件夹暂无归档文件（审核通过的文件将自动进入此处）'}
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </PageCard>
      )}

      {/* R39 文件夹绑定命名骨架弹窗：启用中骨架下拉 + 当前有效骨架信息 + 解绑 */}
      <Dialog open={!!bindFolder} onOpenChange={(o) => !o && setBindFolder(null)}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">绑定命名骨架</DialogTitle>
          <ModalHeader
            title={bindFolder ? `绑定命名骨架 · ${bindFolder.name}` : '绑定命名骨架'}
            onClose={() => setBindFolder(null)}
          />
          {bindFolder && (
            <>
              <div className="space-y-4 p-6">
                {/* 当前有效骨架（含继承来源） */}
                {(() => {
                  const eff = effectiveTemplateRef(state.files, bindFolder.id, state.namingTemplates)
                  return (
                    <div className="rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
                      <div className="text-xs text-gray-400">
                        当前有效骨架
                        {eff ? (eff.inherited ? `（继承自：${eff.holder.name}）` : '（本目录绑定）') : ''}
                      </div>
                      {eff ? (
                        <div className="mt-1 space-y-1.5">
                          <div className="text-sm font-medium text-teal-600">{eff.template.name}</div>
                          <SkeletonText value={eff.template.skeleton} />
                        </div>
                      ) : (
                        <div className="mt-1 text-sm text-gray-400">本目录及上级均未绑定骨架，上传时不启用命名向导</div>
                      )}
                    </div>
                  )
                })()}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-500">选择骨架（仅列出启用中；选「不绑定」即清除本目录绑定）</span>
                  <ToolbarSelect
                    className="w-full [&>select]:w-full"
                    value={bindSel}
                    onChange={setBindSel}
                    options={[
                      { value: '', label: '（不绑定）' },
                      ...state.namingTemplates
                        .filter((t) => t.status === '启用')
                        .map((t) => ({ value: t.id, label: t.name })),
                    ]}
                  />
                </label>
                <p className="text-xs leading-relaxed text-gray-400">
                  绑定 / 换绑 / 解绑仅影响后续上传的文件命名，存量文件名不会改变；子目录未自行绑定时自动继承本目录骨架。
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
                <Button variant="outline" size="sm" disabled={!bindFolder.namingTemplateId} onClick={unbind}>
                  解绑本目录
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setBindFolder(null)}>
                    取消
                  </Button>
                  <Button size="sm" className="gap-1.5 bg-teal-500 text-white hover:bg-teal-600" onClick={saveBind}>
                    <Braces className="h-3.5 w-3.5" /> 保存
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* R39 二阶段A 文件属性弹窗：原文件名只读 / 展示名可改（写审计）/ 业务字段 / 命名历史时间线 */}
      <Dialog open={!!attrFile} onOpenChange={(o) => !o && setAttrFileId(null)}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">文件属性</DialogTitle>
          <ModalHeader title={attrFile ? `文件属性 · ${displayNameOf(attrFile)}` : '文件属性'} onClose={() => setAttrFileId(null)} />
          {attrFile && (
            <>
              <div className="space-y-4 p-6">
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100 text-xs">
                  <div>
                    <div className="text-gray-400">原始文件名（系统留档，不可修改）</div>
                    <div className="mt-0.5 font-mono break-all text-gray-600">{attrFile.originalFilename ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">所属项目 / 更新人员</div>
                    <div className="mt-0.5 text-gray-600">
                      {attrFile.projectNo} / {attrFile.uploader}
                    </div>
                  </div>
                  <div className="col-span-2 flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-gray-400">业务字段：</span>
                    {[
                      attrFile.docType ? `类型 ${attrFile.docType}` : null,
                      attrFile.versionNo ? `V${attrFile.versionNo}` : null,
                      attrFile.docStatus ?? null,
                      attrFile.namingTemplateId
                        ? `骨架 ${state.namingTemplates.find((t) => t.id === attrFile.namingTemplateId)?.name ?? attrFile.namingTemplateId}`
                        : null,
                    ]
                      .filter((s): s is string => !!s)
                      .map((s) => (
                        <span key={s} className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] text-teal-600 ring-1 ring-teal-100">
                          {s}
                        </span>
                      ))}
                    {!attrFile.docType && !attrFile.versionNo && !attrFile.docStatus && !attrFile.namingTemplateId && (
                      <span className="text-gray-300">未经过命名向导（旧数据）</span>
                    )}
                  </div>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-500">展示名（改动将写入命名审计；原始文件名不变）</span>
                  <div className="flex items-center gap-2">
                    <input
                      value={attrName}
                      onChange={(e) => setAttrName(e.target.value)}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50/60 px-3 text-center text-sm text-gray-700 outline-none focus:border-teal-500 focus:bg-white"
                    />
                    <Button size="sm" className="shrink-0 bg-teal-500 text-white hover:bg-teal-600" onClick={saveAttrName}>
                      保存
                    </Button>
                  </div>
                </label>
                {/* 命名历史时间线（新→旧） */}
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500">
                    <History className="h-3.5 w-3.5" /> 命名历史（{attrLogs.length} 条）
                  </div>
                  {attrLogs.length === 0 ? (
                    <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-400 ring-1 ring-gray-100">
                      暂无命名记录（该文件未经命名向导，或为旧数据）
                    </div>
                  ) : (
                    <ul className="max-h-48 space-y-0 overflow-y-auto pr-1">
                      {attrLogs.map((l, idx) => (
                        <li key={l.id} className="relative border-l-2 border-teal-100 pb-3 pl-4 last:pb-0">
                          <span className="absolute top-1 -left-[5px] h-2 w-2 rounded-full bg-teal-400 ring-2 ring-teal-50" />
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
                            <span className="font-mono">{l.time}</span>
                            <span
                              className={
                                l.action === '修改文件名'
                                  ? 'rounded-full bg-amber-50 px-1.5 py-0.5 text-amber-600 ring-1 ring-amber-100'
                                  : l.action === '重名追加'
                                    ? 'rounded-full bg-cyan-50 px-1.5 py-0.5 text-cyan-600 ring-1 ring-cyan-100'
                                    : 'rounded-full bg-teal-50 px-1.5 py-0.5 text-teal-600 ring-1 ring-teal-100'
                              }
                            >
                              {l.action}
                            </span>
                            <span>{l.operator}</span>
                          </div>
                          <div className="mt-0.5 text-xs break-all text-gray-600">
                            {l.oldValue ? <span className="text-gray-400 line-through">{l.oldValue} → </span> : null}
                            <span className="font-medium text-teal-600">{l.newValue}</span>
                          </div>
                          {idx === 0 && <div className="mt-0.5 text-[10px] text-gray-300">最新</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end border-t border-gray-100 px-6 py-4">
                <Button variant="outline" size="sm" onClick={() => setAttrFileId(null)}>
                  关闭
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CatalogDialog open={dialogOpen} onOpenChange={setDialogOpen} type={type} />
      {detail && (
        <TmfUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          catalog={detail}
          currentFolder={currentFolder ?? undefined}
          folderOptions={folderOptions}
        />
      )}
    </div>
  )
}
