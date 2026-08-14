import { Fragment, useMemo, useState } from 'react'
import { Download, ChevronRight } from 'lucide-react'
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
  FavButton,
  TealLink,
} from '@/components/common'
import { siteManageRows, projectOptions } from '@/data/mock'
import { useStore, craNameOf, type Catalog, type TmfFile } from '@/store'

/* 执行人员 SITE TMF：目录来自 PM 创建（store），可逐级钻取查看归档文件（一级→二级→三级，栈式面包屑可回跳） */
export default function ExSiteTmf() {
  const { state, dispatch } = useStore()
  const [search, setSearch] = useState('')
  /* 全局项目筛选：与顶部 Header 下拉联动 */
  const project = state.activeProject
  const setProject = (p: string) => dispatch({ type: 'setActiveProject', project: p })
  const [detail, setDetail] = useState<Catalog | null>(() => {
    const m = window.location.hash.match(/drill=([\w-]+)/)
    return state.catalogs.find((c) => c.id === m?.[1] && c.kind === 'site') ?? null
  })
  /* R36：钻取视图逐级打开已归档文件夹（与 PM 端 TmfPage 同一栈式路径模型）；进入/退出目录时重置 */
  const [folderStack, setFolderStack] = useState<TmfFile[]>([])
  const currentFolder = folderStack[folderStack.length - 1] ?? null
  const enterDetail = (c: Catalog | null) => {
    setDetail(c)
    setFolderStack([])
  }
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
          c.kind === 'site' &&
          (project === '全部' || c.projectNo.startsWith(project)) &&
          c.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [state.catalogs, search, project],
  )

  /* 钻取视图：目录顶层条目（一级文件夹/直属文件）；R36 修复——排除子级（!f.parentId），与 PM 端同口径 */
  const folderFiles = useMemo(
    () =>
      detail
        ? state.files.filter((f) => f.folderId === detail.id && f.status === 'archived' && !f.parentId)
        : [],
    [state.files, detail],
  )
  /* 当前层级子项（二级/三级文件夹与其中的文件） */
  const childFiles = useMemo(
    () =>
      currentFolder ? state.files.filter((f) => f.parentId === currentFolder.id && f.status === 'archived') : [],
    [state.files, currentFolder],
  )

  return (
    <div className="space-y-5">
      {/* 顶部统计 */}
      <PageCard title="SITE TMF 管理">
        <DataTable>
          <thead>
            <tr>
              <Th sortable={false}>研究中心</Th>
              <Th sortable={false}>临床监查员</Th>
              <Th sortable={false}>已上传</Th>
              <Th sortable={false}>审批中</Th>
              <Th sortable={false}>审批通过</Th>
              <Th sortable={false}>归档</Th>
            </tr>
          </thead>
          <tbody>
            {siteManageRows.map((r) => {
              /* R32：CRA 列改读研究中心注册表；未配置显示 — */
              const cra = craNameOf(state.centers, r.name)
              return (
              <Tr key={r.name}>
                <Td>{r.name}</Td>
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
                <Td>{r.reviewing}</Td>
                <Td>{r.approved}</Td>
                <Td>{r.archived}</Td>
              </Tr>
              )
            })}
          </tbody>
        </DataTable>
      </PageCard>

      {detail === null ? (
        <PageCard
          bodyClassName="pt-0"
          className="pt-5"
          title={<span className="sr-only">SITE TMF 列表</span>}
          extra={
            <div className="flex flex-1 items-center justify-between">
              <div className="flex items-center gap-3">
                <SearchInput value={search} onChange={setSearch} className="w-56" />
                <ToolbarSelect
                  value={project}
                  onChange={setProject}
                  options={[{ label: '全部', value: '全部' }, ...projectOptions]}
                />
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
                  <Button variant="outline" className="gap-1.5" onClick={enterDl}>
                    <Download className="h-4 w-4" /> 下载
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <DataTable>
            <thead>
              <tr>
                <NameTh className="w-[22%]">文件名称</NameTh>
                <Th className="w-36">项目编号</Th>
                <Th className="w-36">研究中心</Th>
                <Th className="w-32">更新人员</Th>
                <Th className="w-36">更新日期</Th>
                <Th className="w-28">文件大小</Th>
                <Th sortable={false} className="w-32">文件状态</Th>
              </tr>
            </thead>
            <tbody>
              {catalogs.map((c) => (
                <Tr
                  key={c.id}
                  onClick={() => (dlMode ? toggleDl(c.id) : enterDetail(c))}
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
                      <span className="truncate text-gray-700">{c.name}</span>
                    </span>
                  </NameTd>
                  <Td>{c.projectNo}</Td>
                  <Td>{c.center ?? '—'}</Td>
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
          {/* 面包屑：SITE TMF / 目录 / 逐级文件夹——中间层级可点击回跳 */}
          <div className="mb-4 flex items-center gap-1.5 text-sm">
            <button
              type="button"
              onClick={() => enterDetail(null)}
              className="font-medium text-teal-600 transition-colors hover:text-teal-700 hover:underline"
            >
              SITE TMF
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

          <DataTable>
            <thead>
              <tr>
                <NameTh className="w-[22%]">文件名称</NameTh>
                <Th className="w-36">项目编号</Th>
                <Th className="w-36">更新人员</Th>
                <Th className="w-36">更新日期</Th>
                <Th className="w-28">文件大小</Th>
                <Th sortable={false} className="w-24">操作</Th>
              </tr>
            </thead>
            <tbody>
              {(currentFolder ? childFiles : folderFiles).map((f) => (
                <Tr key={f.id}>
                  <NameTd aside={f.kind !== 'folder' ? <FavButton id={f.id} /> : undefined}>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <FileTypeIcon kind={f.kind} />
                      {f.kind === 'folder' ? (
                        <button
                          type="button"
                          onClick={() => setFolderStack((s) => [...s, f])}
                          title="点击进入下一级"
                          className="truncate text-gray-700 underline decoration-gray-300 decoration-dotted underline-offset-4 transition-colors hover:text-teal-600"
                        >
                          {f.name}
                        </button>
                      ) : (
                        <span className="truncate text-gray-700">{f.name}</span>
                      )}
                    </span>
                  </NameTd>
                  <Td>{f.projectNo}</Td>
                  <Td>{f.uploader}</Td>
                  <Td>{f.uploadDate}</Td>
                  <Td>{f.size}</Td>
                  <Td>
                    {f.kind !== 'folder' && (
                      <TealLink onClick={() => toast.success('已开始下载', { description: f.name })}>下载</TealLink>
                    )}
                  </Td>
                </Tr>
              ))}
              {(currentFolder ? childFiles : folderFiles).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                    {currentFolder ? '该文件夹内暂无文件' : '该文件夹暂无归档文件'}
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </PageCard>
      )}
    </div>
  )
}
