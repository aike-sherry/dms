import { useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ModalHeader } from '@/components/CatalogDialog'
import { DataTable, Th, Td, Tr, NameTh } from '@/components/common'
import { cn } from '@/lib/utils'
import { analyzeName, compareVersion } from '@/lib/smartDoc'
import { useStore, type TmfFile, type FileStatus } from '@/store'

/** 文件状态徽标（与后台管理一致：已上传蓝 / 审核中琥珀 / 驳回玫红 / 归档 teal） */
const STATUS_LABEL: Record<FileStatus, string> = {
  uploaded: '已上传',
  pending: '审核中',
  rejected: '驳回',
  archived: '归档',
}
const STATUS_BADGE: Record<FileStatus, string> = {
  uploaded: 'bg-blue-50 text-blue-600',
  pending: 'bg-amber-50 text-amber-600',
  rejected: 'bg-rose-50 text-rose-500',
  archived: 'bg-teal-50 text-teal-600',
}

/** 版本历史入口：识别出文档类型的文件在名称旁显示 History 图标（未识别类型不显示），
    点击弹出完整版本链弹窗——同项目编号 + 同研究中心 + 同文档类型的全部文件（含已驳回，
    驳回也是历史的一部分），按版本号升序、同版本按上传日期升序 */
export function VersionHist({ file }: { file: TmfFile }) {
  const { state } = useStore()
  const [open, setOpen] = useState(false)
  const analysis = analyzeName(file.name)
  const matched = file.kind !== 'folder' && analysis.matched

  const chain = useMemo(() => {
    if (!matched) return [] as TmfFile[]
    return state.files
      .filter(
        (f) =>
          f.kind !== 'folder' &&
          f.projectNo === file.projectNo &&
          f.center === file.center &&
          analyzeName(f.name).docType === analysis.docType,
      )
      .sort((x, y) => {
        const c = compareVersion(analyzeName(x.name).version ?? 'V1.0', analyzeName(y.name).version ?? 'V1.0')
        return c !== 0 ? c : x.uploadDate.localeCompare(y.uploadDate)
      })
  }, [state.files, file.projectNo, file.center, analysis.docType, matched])

  if (!matched) return null

  const byId = new Map(state.files.map((f) => [f.id, f]))
  /* 归档位置提示：沿 parentId 祖先链拼出「分区 / 文档类型」路径（仅归档行，解析不出则不显示） */
  const archivePath = (f: TmfFile): string => {
    if (f.status !== 'archived') return ''
    const names: string[] = []
    let cur = f.parentId ? byId.get(f.parentId) : undefined
    for (let depth = 0; cur && depth < 10; depth += 1) {
      names.unshift(cur.name)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return names.join(' / ')
  }

  return (
    <>
      <button
        type="button"
        title={`查看版本历史（共 ${chain.length} 个版本）`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className="inline-flex shrink-0 items-center text-gray-300 transition-colors hover:text-teal-500"
      >
        <History className="h-3.5 w-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">版本历史</DialogTitle>
          <ModalHeader title={`版本历史 · ${analysis.docType}（共 ${chain.length} 个版本）`} onClose={() => setOpen(false)} />
          <div className="max-h-[60vh] overflow-auto p-5">
            <DataTable>
              <thead>
                <tr>
                  <Th sortable={false} className="w-16">版本</Th>
                  <NameTh>文件名称</NameTh>
                  <Th sortable={false} className="w-24">上传人员</Th>
                  <Th sortable={false} className="w-28">上传日期</Th>
                  <Th sortable={false} className="w-20">状态</Th>
                  <Th sortable={false} className="w-40">驳回原因</Th>
                </tr>
              </thead>
              <tbody>
                {chain.map((f) => {
                  const current = f.id === file.id
                  const path = archivePath(f)
                  return (
                    <Tr key={f.id} className={cn(current && 'bg-teal-50/70 hover:bg-teal-50/70')}>
                      <Td>
                        <span className="inline-flex items-center justify-center gap-1.5">
                          <span className="font-medium text-gray-700">{analyzeName(f.name).version ?? 'V1.0'}</span>
                          {current && (
                            <span className="rounded-full bg-teal-500 px-1.5 py-px text-[10px] text-white">当前</span>
                          )}
                        </span>
                      </Td>
                      <Td>
                        <div className="whitespace-normal text-gray-700">{f.name}</div>
                        {path && <div className="mt-0.5 text-[11px] text-gray-400">归档位置：{path}</div>}
                      </Td>
                      <Td>{f.uploader}</Td>
                      <Td>{f.uploadDate}</Td>
                      <Td>
                        <span className={cn('rounded-full px-2.5 py-1 text-xs', STATUS_BADGE[f.status])}>
                          {STATUS_LABEL[f.status]}
                        </span>
                      </Td>
                      <Td className="max-w-40 truncate text-xs text-gray-500">
                        <span title={f.status === 'rejected' ? (f.reason ?? '') : ''}>
                          {f.status === 'rejected' ? f.reason || '—' : '—'}
                        </span>
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </DataTable>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
