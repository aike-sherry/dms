import { useMemo, useRef, useState, type DragEvent } from 'react'
import { FileUp, FolderUp, MousePointerClick } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ToolbarSelect } from '@/components/common'
import { ModalHeader } from '@/components/CatalogDialog'
import { cn } from '@/lib/utils'
import { useStore, nextId, todayStr, fmtSize, EXECUTOR_NAME, EXECUTOR_CENTER, type TmfFile } from '@/store'

const FALLBACK_PROJECTS = ['ON101CL01', 'ON101CL103', 'ON101CLCT01']

/** 上传弹窗：卡片式选择「上传文件 / 上传文件夹」，支持拖拽上传（自动识别文件夹）；
    项目编号必选，取自 STUDY TMF 目录，归档时按编号进入对应项目文件夹 */
export default function UploadDialog({
  open,
  onOpenChange,
  uploader = EXECUTOR_NAME,
  center = EXECUTOR_CENTER,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  uploader?: string
  center?: string
}) {
  const { state, dispatch } = useStore()
  const [projectNo, setProjectNo] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)

  /* 项目编号选项：动态取自 STUDY TMF 目录（归档目标），空时回退默认 */
  const projectChoices = useMemo(() => {
    const fromCatalogs = [...new Set(state.catalogs.filter((c) => c.kind === 'study').map((c) => c.projectNo))]
    return fromCatalogs.length > 0 ? fromCatalogs : FALLBACK_PROJECTS
  }, [state.catalogs])

  const requireProject = () => {
    if (!projectNo) {
      toast.warning('请先选择项目编号', { description: '上传前需指定文件归属的项目，用于归档' })
      return false
    }
    return true
  }

  const baseFields = () => ({ projectNo, center, uploader, uploadDate: todayStr(), status: 'uploaded' as const })

  /* 上传文件（可多选）：一律视为文档，项目编号取自下拉 */
  const importFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return
    if (!requireProject()) return
    const files: TmfFile[] = Array.from(list).map((f) => ({
      id: nextId('f'),
      name: f.name,
      kind: 'pdf' as const,
      ...baseFields(),
      size: fmtSize(f.size),
    }))
    dispatch({ type: 'addFiles', files })
    toast.success(`已上传 ${files.length} 个文件`, { description: `项目编号：${projectNo}` })
    onOpenChange(false)
  }

  /* 上传文件夹：创建文件夹条目，内部文件作为其子文件（保留结构，归档时级联） */
  const importDir = (list: FileList | null) => {
    if (!list || list.length === 0) return
    if (!requireProject()) return
    const arr = Array.from(list)
    const rootName = arr[0]?.webkitRelativePath?.split('/')[0] || '新建文件夹'
    const folderId = nextId('f')
    const children: TmfFile[] = arr.map((f) => {
      const rel = f.webkitRelativePath
      return {
        id: nextId('f'),
        name: rel && rel.includes('/') ? rel.split('/').slice(1).join('/') : f.name,
        kind: 'pdf' as const,
        ...baseFields(),
        size: fmtSize(f.size),
        parentId: folderId,
      }
    })
    const folder: TmfFile = {
      id: folderId,
      name: rootName,
      kind: 'folder',
      ...baseFields(),
      size: fmtSize(arr.reduce((s, f) => s + f.size, 0)),
    }
    dispatch({ type: 'addFiles', files: [folder, ...children] })
    toast.success(`已上传文件夹「${rootName}」（${children.length} 个文件）`, {
      description: `项目编号：${projectNo}，归档时文件夹将整体进入该项目 STUDY TMF`,
    })
    onOpenChange(false)
  }

  /* 拖拽上传：含相对路径的按文件夹导入，否则按文件导入 */
  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    const hasDir = Array.from(files).some((f) => f.webkitRelativePath && f.webkitRelativePath.includes('/'))
    if (hasDir) importDir(files)
    else importFiles(files)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">上传文件</DialogTitle>
        <ModalHeader title="上传文件" onClose={() => onOpenChange(false)} />

        <div className="space-y-5 p-6">
          {/* 项目编号（必选）：归档时按编号进入对应 STUDY TMF 文件夹 */}
          <div
            className={cn(
              'flex items-center gap-3 rounded-xl px-4 py-3 ring-1 transition-colors',
              projectNo ? 'bg-gray-50 ring-gray-100' : 'bg-amber-50/60 ring-amber-200',
            )}
          >
            <span className="text-sm whitespace-nowrap text-gray-600">
              项目编号 <span className="text-red-400">*</span>
            </span>
            <ToolbarSelect
              value={projectNo}
              onChange={setProjectNo}
              options={[{ label: '请选择项目编号', value: '' }, ...projectChoices.map((p) => ({ label: p, value: p }))]}
              className="w-56 [&>select]:w-full"
            />
            <span className="ml-auto text-xs text-gray-400">研究中心：{center}</span>
          </div>

          {/* 卡片式上传入口 + 拖拽区 */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'grid grid-cols-2 gap-4 rounded-2xl p-1.5 transition-all',
              dragOver && 'bg-teal-50/70 ring-2 ring-teal-300 ring-offset-2'
            )}
          >
            <button
              type="button"
              onClick={() => requireProject() && fileInputRef.current?.click()}
              className="group flex h-44 flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-gray-200 bg-[#fafbfc] transition-all hover:border-teal-300 hover:bg-teal-50/40 hover:shadow-sm"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600 transition-transform group-hover:scale-110">
                <FileUp className="h-5.5 w-5.5" />
              </span>
              <span className="text-sm font-medium text-gray-700">上传文件</span>
              <span className="px-4 text-center text-xs leading-relaxed text-gray-400">
                支持 PDF / Word 等文档
                <br />
                可多选批量上传
              </span>
            </button>

            <button
              type="button"
              onClick={() => requireProject() && dirInputRef.current?.click()}
              className="group flex h-44 flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-gray-200 bg-[#fafbfc] transition-all hover:border-sky-300 hover:bg-sky-50/40 hover:shadow-sm"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600 transition-transform group-hover:scale-110">
                <FolderUp className="h-5.5 w-5.5" />
              </span>
              <span className="text-sm font-medium text-gray-700">上传文件夹</span>
              <span className="px-4 text-center text-xs leading-relaxed text-gray-400">
                保留文件夹结构
                <br />
                归档时整体进入项目目录
              </span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <MousePointerClick className="h-3.5 w-3.5" />
            也可以将文件或文件夹直接拖拽到上方区域上传
          </div>
          <p className="text-center text-xs text-gray-300">
            文件与文件夹均按所选项目编号，归档至对应的 STUDY TMF 文件夹
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            importFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={dirInputRef}
          type="file"
          multiple
          className="hidden"
          {...({ webkitdirectory: 'true' } as Record<string, string>)}
          onChange={(e) => {
            importDir(e.target.files)
            e.target.value = ''
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
