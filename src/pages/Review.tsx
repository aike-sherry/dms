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
  Tr,
  ToolbarSelect,
  SearchInput,
  FileTypeIcon,
  TealLink,
} from '@/components/common'
import { projectOptions } from '@/data/mock'
import { useStore, statsByCenter, type TmfFile } from '@/store'

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

  const archive = (id: string, name: string) => {
    dispatch({ type: 'archiveFile', id })
    toast.success('归档成功', { description: `${name} 已进入 TMF 目录，执行端列表同步移除` })
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
              <Th sortable={false}>文件名称</Th>
              <Th>项目编号</Th>
              <Th>上传人员</Th>
              <Th>更新日期</Th>
              <Th>文件大小</Th>
              <Th sortable={false}>操作</Th>
            </tr>
          </thead>
          <tbody>
            {pendingFiles.map((f) => (
              <Tr key={f.id}>
                <NameTd>
                  <span className="flex items-center gap-2.5">
                    <FileTypeIcon kind={f.kind} />
                    <span className="text-gray-700">{f.name}</span>
                  </span>
                </NameTd>
                <Td>{f.projectNo}</Td>
                <Td>{f.uploader}</Td>
                <Td>{f.uploadDate}</Td>
                <Td>{f.size}</Td>
                <Td>
                  <span className="flex items-center gap-4">
                    <TealLink onClick={() => (f.kind === 'folder' ? setFolderView(f) : onOpenPdf(f.id))}>审核</TealLink>
                    <TealLink onClick={() => archive(f.id, f.name)}>归档</TealLink>
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
                  <Th sortable={false}>文件名称</Th>
                  <Th sortable={false}>文件大小</Th>
                  <Th sortable={false}>操作</Th>
                </tr>
              </thead>
              <tbody>
                {childFiles.map((f) => (
                  <Tr key={f.id}>
                    <NameTd>
                      <span className="flex items-center gap-2.5">
                        <FileTypeIcon kind={f.kind} />
                        <span className="text-gray-700">{f.name}</span>
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
