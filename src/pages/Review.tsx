import { useMemo, useState } from 'react'
import { Download, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  TealLink,
} from '@/components/common'
import { VersionHist } from '@/components/VersionHist'
import { projectOptions } from '@/data/mock'
import { planArchive } from '@/lib/archiveRouter'
import { useStore, statsByCenter, PM_USER, type TmfFile } from '@/store'

/* PM 文件审核：展示执行人员提交的待审核文件；文件夹可打开后对内部文件逐一审核 */
export default function Review({ onOpenPdf }: { onOpenPdf: (fileId: string) => void }) {
  const { state, dispatch } = useStore()
  /* 全局项目筛选：与顶部 Header 下拉联动 */
  const project = state.activeProject
  const setProject = (p: string) => dispatch({ type: 'setActiveProject', project: p })
  const [search, setSearch] = useState('')
  const [folderView, setFolderView] = useState<TmfFile | null>(null)

  const stats = useMemo(() => statsByCenter(state.files), [state.files])
  /* 顶层待审核：不含文件夹内的子文件；随全局项目筛选 */
  const pendingFiles = useMemo(
    () =>
      state.files.filter(
        (f) =>
          f.status === 'pending' &&
          !f.parentId &&
          (project === '全部' || f.projectNo.startsWith(project)) &&
          f.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [state.files, search, project],
  )
  /* 当前打开文件夹内的待审核子文件 */
  const childFiles = useMemo(
    () => (folderView ? state.files.filter((f) => f.parentId === folderView.id && f.status === 'pending') : []),
    [state.files, folderView],
  )

  /* 审核通过归档：CRA 上传时选定目标文件夹的文件直接落入该 SITE TMF 文件夹（跳过路由表），
     其余与 TRANSFER 相同的路由落位（识别 docType → 路由表 → 分区/文档类型文件夹，未识别进 99 待分拣）；
     文件夹级联时子文件各自判断 */
  const archive = (f: TmfFile) => {
    const children =
      f.kind === 'folder' ? state.files.filter((x) => x.parentId === f.id && x.status === 'pending') : []
    const plan = planArchive({
      file: f,
      children,
      files: state.files,
      catalogs: state.catalogs,
      routes: state.archiveRoutes,
      uploader: PM_USER.name,
    })
    if (!plan) {
      toast.error('未找到 STUDY TMF 目录', { description: '请先在 STUDY TMF 页创建目录后再归档' })
      return
    }
    dispatch({ type: 'archiveRouted', newFolders: plan.newFolders, entries: plan.entries })
    const okLines = [...plan.groups.entries()].map(([p, n]) => `已归档至 STUDY TMF / ${p}（${n} 个文件）`)
    const siteLines = [...plan.siteGroups.entries()].map(([p, n]) => `已归档至 SITE TMF / ${p}（${n} 个文件）`)
    const allLines = [...siteLines, ...okLines]
    if (f.kind === 'folder') allLines.unshift(`文件夹「${f.name}」及子文件已归档`)
    /* C4：路由来源行（仅本批有按业务字段路由时追加，纯文件名解析批保持旧文案） */
    if (plan.routeSources.docType > 0) {
      allLines.push(`路由来源：业务字段 ${plan.routeSources.docType} 个 · 文件名解析 ${plan.routeSources.filenameParse} 个`)
    }
    if (allLines.length > 0) {
      toast.success('归档成功', { description: `${allLines.join('；')}，执行端列表同步移除` })
    }
    if (plan.unsorted > 0) {
      toast.warning(`${plan.unsorted} 个文件进入「99 待分拣」`, {
        description: '未识别文档类型或无匹配路由，已归档至 STUDY TMF / 99 待分拣，需人工分拣',
      })
    }
  }

  return (
    <div className="space-y-5">
      <PageCard
        title="文件状态"
        extra={
          <ToolbarSelect
            value={project}
            onChange={setProject}
            options={[{ label: '全部', value: '全部' }, ...projectOptions]}
          />
        }
      >
        <DataTable>
          <thead>
            <tr>
              <Th sortable={false}>研究中心</Th>
              <Th sortable={false}>已上传</Th>
              <Th sortable={false}>待审批</Th>
              <Th sortable={false}>驳回</Th>
              <Th sortable={false}>归档</Th>
            </tr>
          </thead>
          <tbody>
            {stats.map((r) => (
              <Tr key={r.center}>
                <Td>{r.center}</Td>
                <Td>{r.uploaded}</Td>
                <Td>{r.pending}</Td>
                <Td>{r.rejected}</Td>
                <Td>{r.archived}</Td>
              </Tr>
            ))}
            {stats.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-gray-400">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </PageCard>

      <PageCard
        title="文件审核"
        extra={
          <div className="flex items-center gap-3">
            <SearchInput value={search} onChange={setSearch} className="w-56" />
            <Button variant="outline" className="gap-1.5" onClick={() => toast.success('下载完成')}>
              <Download className="h-4 w-4" /> 下载
            </Button>
          </div>
        }
      >
        <DataTable>
          <thead>
            <tr>
              <NameTh className="w-[24%]">文件名称</NameTh>
              <Th className="w-36">项目编号</Th>
              <Th className="w-32">上传人员</Th>
              <Th className="w-36">更新日期</Th>
              <Th className="w-28">文件大小</Th>
              <Th sortable={false} className="w-32">操作</Th>
            </tr>
          </thead>
          <tbody>
            {pendingFiles.map((f) => (
              <Tr key={f.id}>
                <NameTd>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <FileTypeIcon kind={f.kind} />
                    <span className="truncate text-gray-700">{f.name}</span>
                    <VersionHist file={f} />
                  </span>
                </NameTd>
                <Td>{f.projectNo}</Td>
                <Td>{f.uploader}</Td>
                <Td>{f.uploadDate}</Td>
                <Td>{f.size}</Td>
                <Td>
                  <span className="flex items-center gap-4">
                    <TealLink onClick={() => (f.kind === 'folder' ? setFolderView(f) : onOpenPdf(f.id))}>审核</TealLink>
                    <TealLink onClick={() => archive(f)}>归档</TealLink>
                  </span>
                </Td>
              </Tr>
            ))}
            {pendingFiles.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                  暂无待审核文件（执行人员提交后将出现在此处）
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </PageCard>

      {/* 文件夹审核弹窗：打开文件夹，对内部文件逐一审核 */}
      <Dialog open={!!folderView} onOpenChange={(o) => !o && setFolderView(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-5 w-5 text-amber-500" />
              {folderView?.name}
            </DialogTitle>
          </DialogHeader>
          {folderView && (
            <DataTable>
              <thead>
                <tr>
                  <NameTh>文件名称</NameTh>
                  <Th sortable={false} className="w-28">文件大小</Th>
                  <Th sortable={false} className="w-20">操作</Th>
                </tr>
              </thead>
              <tbody>
                {childFiles.map((f) => (
                  <Tr key={f.id}>
                    <NameTd>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <FileTypeIcon kind={f.kind} />
                        <span className="truncate text-gray-700">{f.name}</span>
                        <VersionHist file={f} />
                      </span>
                    </NameTd>
                    <Td>{f.size}</Td>
                    <Td>
                      <TealLink
                        onClick={() => {
                          setFolderView(null)
                          onOpenPdf(f.id)
                        }}
                      >
                        审核
                      </TealLink>
                    </Td>
                  </Tr>
                ))}
                {childFiles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-sm text-gray-400">
                      文件夹内暂无待审核文件
                    </td>
                  </tr>
                )}
              </tbody>
            </DataTable>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
