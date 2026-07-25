import { useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, FolderArchive, Ban, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { FileTypeIcon } from '@/components/common'
import ReportDocument from '@/components/ReportDocument'
import { cn } from '@/lib/utils'
import { pdfChangeLogs, pdfFileName } from '@/data/mock'
import { useStore } from '@/store'

const PAGE_COUNT = 4
/* 缩略图缩放比例：A4 文档宽 794px → 缩略到约 112px */
const THUMB_SCALE = 112 / 794

function Thumbnail({ page, active, onClick }: { page: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'block w-full overflow-hidden rounded-md border-2 bg-white transition-all',
        active ? 'border-teal-500 shadow-[0_0_0_2px_rgba(20,184,166,0.2)]' : 'border-gray-200 hover:border-teal-300',
      )}
    >
      <div className="pointer-events-none overflow-hidden" style={{ height: Math.round(1123 * THUMB_SCALE) }}>
        <div style={{ transform: `scale(${THUMB_SCALE})`, transformOrigin: 'top left', width: 794 }}>
          <ReportDocument page={page} />
        </div>
      </div>
      <div className={cn('py-1 text-center text-[10px]', active ? 'font-medium text-teal-600' : 'text-gray-400')}>
        第 {page} 页
      </div>
    </button>
  )
}

const statusText: Record<string, string> = {
  uploaded: '待提交',
  pending: '待审核',
  rejected: '已驳回',
  archived: '已归档',
}

export default function PdfPreview({ fileId, onBack }: { fileId: string; onBack: () => void }) {
  const { state, dispatch } = useStore()
  const file = state.files.find((f) => f.id === fileId)
  const displayName = file?.name ?? pdfFileName

  const [page, setPage] = useState(1)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [opinion, setOpinion] = useState('')
  const [archived, setArchived] = useState(false)

  const attrs = useMemo(
    () => [
      { label: '文件名', value: displayName },
      { label: '项目编号', value: file?.projectNo ?? 'ON101CLCT06' },
      { label: '研究中心', value: file?.center ?? '上海瑞金医院' },
      { label: '文件类型', value: file?.kind === 'folder' ? '文件夹' : 'PDF' },
      { label: '文件大小', value: file?.size ?? '193.1KB' },
      { label: '版本', value: 'V1.0' },
      { label: '上传人', value: file?.uploader ?? '张兰' },
      { label: '上传日期', value: file?.uploadDate ?? '2026-02-12' },
      { label: '审核人', value: '石磊' },
      { label: '状态', value: statusText[file?.status ?? 'pending'] },
      { label: '归档状态', value: archived || file?.status === 'archived' ? '已归档' : '未归档' },
      { label: '密级', value: '内部' },
    ],
    [file, displayName, archived],
  )

  /* 审核通过 → 自动归档到 TMF 文件夹，从执行端列表消失 */
  const approve = () => {
    if (file) dispatch({ type: 'approveFile', id: file.id })
    toast.success('审核通过', { description: '文件已自动归档到 TMF 目录，执行端上传列表同步移除' })
    onBack()
  }

  /* 驳回 → 保留在执行端列表并显示原因 */
  const reject = () => {
    const reason = opinion.trim()
    if (!reason) {
      toast.warning('请先填写驳回原因（审核意见）')
      return
    }
    if (file) dispatch({ type: 'rejectFile', id: file.id, reason })
    toast.error('已驳回该文件', { description: '文件保留在执行端上传列表，等待更新后重新提交' })
    onBack()
  }

  const archiveDirect = () => {
    if (file) dispatch({ type: 'archiveFile', id: file.id })
    setArchived(true)
    toast.success('归档成功', { description: '文件已进入 TMF 目录，执行端列表同步移除' })
  }

  return (
    <div className="space-y-5">
      {/* 顶部工具条 */}
      <div className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 shadow-[0_1px_10px_rgba(15,23,42,0.05)]">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-teal-600"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
          <FileTypeIcon kind="pdf" className="h-6 w-6 shrink-0" />
          <span className="truncate text-sm font-medium text-gray-800">{displayName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Button variant="outline" className="gap-1.5" onClick={() => setSheetOpen(true)}>
            <BookOpen className="h-4 w-4" /> 文件属性
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={archiveDirect} disabled={archived}>
            <FolderArchive className="h-4 w-4" /> {archived ? '已归档' : '归档'}
          </Button>
          <Button variant="outline" className="gap-1.5 text-gray-600 hover:text-red-500" onClick={reject}>
            <Ban className="h-4 w-4" /> 驳回
          </Button>
          <Button className="gap-1.5 bg-teal-500 text-white hover:bg-teal-600" onClick={() => toast.success('下载完成')}>
            <Download className="h-4 w-4" /> 下载
          </Button>
        </div>
      </div>

      {/* 主体：缩略图 + 文档 */}
      <div className="flex items-start gap-5">
        <div className="w-[132px] shrink-0 space-y-3 rounded-2xl bg-white p-3 shadow-[0_1px_10px_rgba(15,23,42,0.05)]">
          {Array.from({ length: PAGE_COUNT }, (_, i) => i + 1).map((p) => (
            <Thumbnail key={p} page={p} active={page === p} onClick={() => setPage(p)} />
          ))}
        </div>

        <div className="min-w-0 flex-1 rounded-2xl bg-[#eceef3] p-6 shadow-[0_1px_10px_rgba(15,23,42,0.05)]">
          <ReportDocument page={page} />
        </div>
      </div>

      {/* 底部审核操作条 */}
      <div className="flex items-start gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_10px_rgba(15,23,42,0.05)]">
        <div className="flex-1">
          <div className="mb-2 text-sm font-medium text-gray-700">审核意见</div>
          <Textarea
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            placeholder="请输入审核意见（驳回时作为驳回原因通知执行人员）…"
            className="min-h-[76px] resize-none border-gray-200 focus-visible:ring-teal-500"
          />
        </div>
        <div className="flex shrink-0 flex-col gap-2.5 pt-7">
          <Button className="w-28 bg-teal-500 text-white hover:bg-teal-600" onClick={approve}>
            通过
          </Button>
          <Button
            variant="outline"
            className="w-28 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
            onClick={reject}
          >
            驳回
          </Button>
        </div>
      </div>

      {/* 文件属性 Drawer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[440px] overflow-y-auto sm:max-w-[440px]">
          <SheetHeader>
            <SheetTitle>文件属性</SheetTitle>
          </SheetHeader>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 px-4">
            {attrs.map((attr) => (
              <div key={attr.label} className={attr.label === '文件名' ? 'col-span-2' : ''}>
                <div className="text-xs text-gray-400">{attr.label}</div>
                <div className="mt-1 text-sm font-medium break-all text-gray-800">{attr.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 px-4 pb-6">
            <div className="mb-3 text-sm font-semibold text-gray-800">修改日志</div>
            <div className="space-y-3">
              {pdfChangeLogs.map((log, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-[#f8f9fb] px-3.5 py-2.5">
                  <div>
                    <div className="text-sm text-gray-700">
                      {log.user} · {log.action}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">{log.time}</div>
                  </div>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
