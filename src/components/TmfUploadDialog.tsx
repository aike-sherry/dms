import { useMemo, useRef, useState } from 'react'
import { FilePlus2, FileText, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ModalHeader } from '@/components/common'
import { cn } from '@/lib/utils'
import { useStore, nextId, todayStr, fmtSize, PM_USER, type Catalog, type TmfFile } from '@/store'
import {
  analyzeName,
  applyNamingTemplate,
  dedupName,
  resolveChainVersion,
  type ChainResolution,
} from '@/lib/smartDoc'

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.png'

interface Pending {
  file: File
  docType: string
}

interface Planned {
  p: Pending
  name: string
  chain: ChainResolution | null
}

/** TMF 钻取视图内直接上传：套用命名规则模板自动命名（版本链沿用 R8：同项目同中心同文档类型
    历史最大版 +1），确认后直接归档落当前层级（folderId=目录、parentId=当前文件夹） */
export default function TmfUploadDialog({
  open,
  onOpenChange,
  catalog,
  currentFolder,
  folderOptions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog: Catalog
  currentFolder?: TmfFile
  /** 可改选的同目录文件夹名（文档类型下拉选项） */
  folderOptions: string[]
}) {
  const { state, dispatch } = useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const center = catalog.center ?? ''
  const targetName = currentFolder?.name ?? catalog.name

  const options = useMemo(() => {
    const s = new Set(folderOptions.filter(Boolean))
    if (currentFolder) s.add(currentFolder.name)
    return [...s]
  }, [folderOptions, currentFolder])

  /* 暂存已选文件：在文件夹内时文档类型默认=当前文件夹名；
     目录根层级按 analyzeName 命中的词典类型与文件夹名做包含匹配预选，未命中留空待手选 */
  const addFiles = (list: FileList | null) => {
    if (!list?.length) return
    const fresh = Array.from(list)
      .filter((f) => !pending.some((p) => p.file.name === f.name))
      .map((file) => {
        if (currentFolder) return { file, docType: currentFolder.name }
        const a = analyzeName(file.name)
        const hit = a.matched ? (options.find((o) => o.includes(a.docType) || a.docType.includes(o)) ?? '') : ''
        return { file, docType: hit }
      })
    if (!fresh.length) return
    setPending((prev) => [...prev, ...fresh])
    toast.success(`已添加 ${fresh.length} 个文件`)
  }

  /* 逐行命名预览：按命名规则模板实时渲染；版本沿用版本链（同项目同中心同文档类型库内历史
     最大版 +1）。批内多个新文件各自按库内历史解析、不互相递增（两份不同简历应各自 V1.0；
     「同名再传」时库内已有 V1.0，自然得到 V2.0 并关联 versionOf）。批内渲染重名由 dedupName
     追加序号（siblings 随行累积） */
  const plan = useMemo<Planned[]>(() => {
    const siblings = state.files.map((f) => f.name)
    return pending.map((p) => {
      if (!p.docType) return { p, name: '', chain: null }
      const a = analyzeName(p.file.name)
      const docType = analyzeName(p.docType).docType || p.docType
      const chain = resolveChainVersion(p.file.name, docType, {
        files: state.files,
        projectNo: catalog.projectNo,
        center,
      })
      const name = dedupName(
        applyNamingTemplate(state.namingTemplate, {
          projectNo: catalog.projectNo,
          docType: p.docType,
          version: chain.version,
          date: a.date ?? todayStr(),
          center,
        }),
        siblings,
      )
      siblings.push(name)
      return { p, name, chain }
    })
  }, [pending, state.files, state.namingTemplate, catalog.projectNo, center])

  const validCount = plan.filter((it) => it.chain).length

  const confirm = () => {
    if (!validCount) return
    const now = todayStr()
    const files: TmfFile[] = plan
      .filter((it) => it.chain)
      .map((it) => ({
        id: nextId('f'),
        name: it.name,
        kind: 'pdf' as const,
        projectNo: catalog.projectNo,
        center,
        uploader: PM_USER.name,
        uploadDate: now,
        size: fmtSize(it.p.file.size),
        status: 'archived' as const,
        folderId: catalog.id,
        parentId: currentFolder?.id,
        versionOf: it.chain!.versionOf,
      }))
    dispatch({ type: 'addFiles', files })
    const chains = files.filter((f) => f.versionOf).length
    toast.success(`已上传 ${files.length} 个文件到「${targetName}」`, {
      description: chains > 0 ? `其中 ${chains} 个检测到历史版本，已自动递增并关联版本链` : undefined,
    })
    setPending([])
    onOpenChange(false)
  }

  const close = (o: boolean) => {
    if (!o) setPending([])
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">上传文件到当前目录</DialogTitle>
        <ModalHeader title={`上传到「${targetName}」`} onClose={() => close(false)} />

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
          {/* 归属提示 */}
          <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
            <InfoBit label="项目编号" value={catalog.projectNo} />
            {center && <InfoBit label="研究中心" value={center} />}
            <InfoBit label="归档位置" value={currentFolder ? `${catalog.name} / ${currentFolder.name}` : catalog.name} />
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-6 text-gray-500 transition-colors hover:border-teal-400 hover:bg-teal-50/40 hover:text-teal-600"
          >
            <FilePlus2 className="h-6 w-6 text-gray-400" />
            <span className="text-[13px] font-medium">点击选择本地文件（可多选）</span>
            <span className="text-[11px] text-gray-400">支持 PDF / Word / Excel / PPT / JPG / PNG</span>
          </button>

          {plan.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-[11px] font-semibold text-gray-500">
                <span className="min-w-0 flex-1">原文件名</span>
                <span className="w-44 shrink-0">文档类型（归档文件夹）</span>
                <span className="w-6 shrink-0" />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {plan.map((it, i) => (
                  <div key={it.p.file.name} className="border-b border-gray-100 px-4 py-2.5 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-teal-600" />
                        <span className="truncate text-[12.5px] font-medium text-gray-700">{it.p.file.name}</span>
                      </div>
                      <select
                        value={it.p.docType}
                        onChange={(e) =>
                          setPending((prev) => prev.map((q, j) => (j === i ? { ...q, docType: e.target.value } : q)))
                        }
                        className={cn(
                          'w-44 shrink-0 rounded-lg border px-2 py-1.5 text-[12px] focus:border-teal-500 focus:outline-none',
                          it.p.docType
                            ? 'border-gray-200 text-gray-700'
                            : 'border-amber-300 bg-amber-50 text-amber-600',
                        )}
                      >
                        <option value="">选择文件夹…</option>
                        {options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {it.chain && (
                      <div className="mt-1 truncate pl-6 text-[11px] text-teal-600">
                        → {it.name}
                        {it.chain.prevVersion && (
                          <span className="ml-1 text-gray-400">
                            （检测到历史版本 {it.chain.prevVersion}，自动递增为 {it.chain.version}）
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" onClick={() => close(false)}>
            取消
          </Button>
          <Button
            disabled={!validCount}
            onClick={confirm}
            className="gap-1.5 bg-teal-500 text-white hover:bg-teal-600"
          >
            <Upload className="h-4 w-4" /> 确认上传{validCount > 0 ? `（${validCount} 个文件）` : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InfoBit({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className="truncate text-[13px] font-medium text-gray-700">{value}</div>
    </div>
  )
}
