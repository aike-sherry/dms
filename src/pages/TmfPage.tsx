import { useMemo, useState } from 'react'
import { Plus, Download, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  PageCard,
  DataTable,
  Th,
  Td,
  NameTd,
  Tr,
  ToolbarSelect,
  SearchInput,
  FileTypeIcon,
  StatusPill,
  TealLink,
  FavButton,
} from '@/components/common'
import CatalogDialog from '@/components/CatalogDialog'
import { projectOptions } from '@/data/mock'
import { useStore, craOfCenter, type Catalog, type TmfFile } from '@/store'

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
  /* 钻取视图内再打开已归档文件夹 */
  const [openFolder, setOpenFolder] = useState<TmfFile | null>(null)
  /* 下载选择模式：勾选文件夹后批量下载，可取消 */
  const [dlMode, setDlMode] = useState(false)
  const [dlSel, setDlSel] = useState<Set<string>>(new Set())
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

  /* 管理统计卡：按项目编号（STUDY）/ 研究中心（SITE）从文件实时派生（随全局项目筛选） */
  const manageRows = useMemo(() => {
    const matchProject = (projectNo: string) => project === '全部' || projectNo.startsWith(project)
    const catIds = new Set(state.catalogs.filter((c) => c.kind === type).map((c) => c.id))
    const keys = new Set<string>()
    for (const c of state.catalogs)
      if (c.kind === type && matchProject(c.projectNo)) keys.add(isStudy ? c.projectNo : (c.center ?? ''))
    for (const f of state.files) if (!f.parentId && matchProject(f.projectNo)) keys.add(isStudy ? f.projectNo : f.center)
    return [...keys].filter(Boolean).map((key) => {
      const tops = state.files.filter(
        (f) => !f.parentId && matchProject(f.projectNo) && (isStudy ? f.projectNo : f.center) === key,
      )
      const archivedHere = state.files.filter(
        (f) =>
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
    () => (openFolder ? state.files.filter((f) => f.parentId === openFolder.id && f.status === 'archived') : []),
    [state.files, openFolder],
  )

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
            {manageRows.map((r) => (
              <Tr key={r.name}>
                <Td>{r.name}</Td>
                {!isStudy && (
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-[11px] font-medium text-teal-600">
                        {craOfCenter(state.craMap, r.name).slice(0, 1)}
                      </span>
                      {craOfCenter(state.craMap, r.name)}
                    </span>
                  </Td>
                )}
                <Td>{r.uploaded}</Td>
                <Td>{r.reviewing}</Td>
                <Td>{r.approved}</Td>
                <Td>{r.archived}</Td>
              </Tr>
            ))}
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
                <Th sortable={false}>文件夹名称</Th>
                <Th>项目编号</Th>
                <Th>创建日期</Th>
                <Th>创建人员</Th>
                <Th>更新日期</Th>
                <Th>文件大小</Th>
                <Th sortable={false}>文件状态</Th>
              </tr>
            </thead>
            <tbody>
              {catalogs.map((c) => (
                <Tr
                  key={c.id}
                  onClick={() => (dlMode ? toggleDl(c.id) : setDetail(c))}
                  className={dlMode && dlSel.has(c.id) ? 'bg-teal-50/60' : undefined}
                >
                  <NameTd>
                    <span className="flex items-center gap-2.5">
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
                      <span className="text-gray-700">{c.name}</span>
                    </span>
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
                    未找到匹配的文件夹
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </PageCard>
      ) : (
        <PageCard bodyClassName="pt-0" className="pt-5">
          {/* 面包屑返回 */}
          <div className="mb-4 flex items-center gap-1.5 text-sm">
            <button
              type="button"
              onClick={() => {
                setDetail(null)
                setOpenFolder(null)
              }}
              className="font-medium text-teal-600 transition-colors hover:text-teal-700 hover:underline"
            >
              {label}
            </button>
            <ChevronRight className="h-4 w-4 text-gray-300" />
            {openFolder ? (
              <button
                type="button"
                onClick={() => setOpenFolder(null)}
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
            {openFolder && (
              <>
                <ChevronRight className="h-4 w-4 text-gray-300" />
                <span className="flex items-center gap-2 text-gray-700">
                  <FileTypeIcon kind="folder" className="h-4 w-4" />
                  {openFolder.name}
                </span>
              </>
            )}
          </div>

          <DataTable>
            <thead>
              <tr>
                <Th sortable={false}>文件名称</Th>
                <Th>项目编号</Th>
                <Th>更新人员</Th>
                <Th>更新日期</Th>
                <Th>文件大小</Th>
                <Th sortable={false}>操作</Th>
              </tr>
            </thead>
            <tbody>
              {(openFolder ? childFiles : folderFiles).map((f) => (
                <Tr key={f.id}>
                  <NameTd aside={f.kind !== 'folder' ? <FavButton id={f.id} /> : undefined}>
                    <span className="flex items-center gap-2.5">
                      <FileTypeIcon kind={f.kind} />
                      {f.kind === 'folder' && !openFolder ? (
                        <button
                          type="button"
                          onClick={() => setOpenFolder(f)}
                          className="text-gray-700 underline decoration-gray-300 decoration-dotted underline-offset-4 transition-colors hover:text-teal-600"
                        >
                          {f.name}
                        </button>
                      ) : (
                        <span className="text-gray-700">{f.name}</span>
                      )}
                    </span>
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
              {(openFolder ? childFiles : folderFiles).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                    {openFolder ? '该文件夹内暂无文件' : '该文件夹暂无归档文件（审核通过的文件将自动进入此处）'}
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </PageCard>
      )}

      <CatalogDialog open={dialogOpen} onOpenChange={setDialogOpen} type={type} />
    </div>
  )
}
