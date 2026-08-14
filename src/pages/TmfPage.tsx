import { Fragment, useEffect, useMemo, useState } from 'react'
import { Plus, Download, ChevronRight, Upload, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
} from '@/components/common'
import CatalogDialog from '@/components/CatalogDialog'
import TmfUploadDialog from '@/components/TmfUploadDialog'
import { projectOptions } from '@/data/mock'
import { useStore, craNameOf, type Catalog, type TmfFile } from '@/store'

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
                          <span className="truncate text-gray-700">{f.name}</span>
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
                      </span>
                    )}
                  </NameTd>
                  <Td>{f.projectNo}</Td>
                  <Td>{f.uploader}</Td>
                  <Td>{f.uploadDate}</Td>
                  <Td>{f.size}</Td>
                  <Td>
                    <TealLink onClick={() => toast.success('命名设置已打开')}>命名设置</TealLink>
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
