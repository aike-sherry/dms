import { useMemo, useRef, useState } from 'react'
import { FilePlus2, FileText, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ModalHeader } from '@/components/common'
import ConfirmNamingDialog, { type NamingJobItem, type NamingJobResult } from '@/components/ConfirmNamingDialog'
import { cn } from '@/lib/utils'
import { effectiveTemplateRef } from '@/lib/namingSkeleton'
import { useStore, nextId, todayStr, nowStr, fmtSize, displayNameOf, PM_USER, type Catalog, type TmfFile, type NamingLog } from '@/store'
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
  /* 收敛C1：钻取上传骨架命名确认弹窗开关（currentFolder 绑定/继承启用中骨架时走确认制） */
  const [namingOpen, setNamingOpen] = useState(false)
  const center = catalog.center ?? ''
  const targetName = currentFolder?.name ?? catalog.name

  /* 收敛C1：当前文件夹的有效骨架（含继承，须启用中）；仅钻取到文件夹层级才可能有绑定 */
  const boundEff = currentFolder ? effectiveTemplateRef(state.files, currentFolder.id, state.namingTemplates) : null
  const bound = boundEff && boundEff.template.status === '启用' ? boundEff : null

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
    /* 收敛C1：目标文件夹绑骨架 → 转骨架命名确认制（确认后才落库+审计），不再走模板自动命名直落 */
    if (bound && currentFolder) {
      setNamingOpen(true)
      return
    }
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

  /* 收敛C1：骨架命名确认回调——逐行六字段落库 + namingLogs 审计（操作人=PM、role='pm'） */
  const confirmNaming = (results: NamingJobResult[]) => {
    if (!bound || !currentFolder) return
    const rById = new Map(results.map((r) => [r.id, r]))
    const now = todayStr()
    const time = nowStr()
    const files: TmfFile[] = pending.map((p, i) => {
      const r = rById.get(String(i))!
      return {
        id: nextId('f'),
        name: r.finalName,
        displayFilename: r.finalName,
        originalFilename: p.file.name,
        namingTemplateId: bound.template.id,
        versionNo: r.versionNo,
        docStatus: r.docStatus,
        docType: r.docType,
        targetFolderId: currentFolder.id,
        kind: 'pdf' as const,
        projectNo: catalog.projectNo,
        center,
        uploader: PM_USER.name,
        uploadDate: now,
        size: fmtSize(p.file.size),
        status: 'archived' as const,
        folderId: catalog.id,
        parentId: currentFolder.id,
      }
    })
    const logs: NamingLog[] = files.map((f, i) => {
      const r = rById.get(String(i))!
      return {
        id: nextId('nl'),
        fileId: f.id,
        operator: PM_USER.name,
        time,
        action: r.action,
        oldValue: r.oldValue,
        newValue: r.finalName,
        projectNo: catalog.projectNo,
        role: 'pm' as const,
        originalFilename: f.originalFilename,
      }
    })
    dispatch({ type: 'addFiles', files })
    dispatch({ type: 'addNamingLogs', logs })
    toast.success(`已上传 ${files.length} 个文件到「${targetName}」`, {
      description: '已按骨架确认命名，审计已记录',
    })
    setPending([])
    setNamingOpen(false)
    onOpenChange(false)
  }

  /* 收敛C1：确认弹窗条目（id=暂存序号，onConfirm 按 id 回传对应行） */
  const namingItems: NamingJobItem[] =
    bound && currentFolder
      ? pending.map((p, i) => ({
          id: String(i),
          from: p.file.name,
          projectNo: catalog.projectNo,
          center,
          folderId: currentFolder.id,
          folderName: currentFolder.name,
          eff: bound,
        }))
      : []

  const close = (o: boolean) => {
    if (!o) setPending([])
    onOpenChange(o)
  }

  return (
    <>
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

          {/* 收敛C1：目标文件夹已绑定骨架——确认上传后逐行确认命名（落库+审计） */}
          {bound && (
            <div className="flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-2.5 text-[12px] leading-5 text-teal-700 ring-1 ring-teal-100">
              <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-teal-600 ring-1 ring-teal-100">
                骨架·{bound.template.name}
                {bound.inherited ? '（继承）' : ''}
              </span>
              目标文件夹已绑定命名骨架——点击「确认上传」后将逐行确认规范文件名，确认后才落库并写入命名审计
            </div>
          )}

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
                      {/* 收敛C1：绑骨架时文档类型列换为骨架 chip（类型在确认弹窗内按骨架限定选择） */}
                      {bound ? (
                        <span className="flex w-44 shrink-0 justify-center">
                          <span className="rounded-full bg-teal-50 px-2 py-1 text-[11px] whitespace-nowrap text-teal-600 ring-1 ring-teal-100">
                            骨架·{bound.template.name}
                            {bound.inherited ? '（继承）' : ''}
                          </span>
                        </span>
                      ) : (
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
                      )}
                      <button
                        type="button"
                        onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {/* 收敛C1：绑骨架时命名预览由确认弹窗接管，此处不再展示模板自动命名预览 */}
                    {!bound && it.chain && (
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

    {/* 收敛C1：上传命名确认弹窗——目标文件夹绑骨架时逐行确认（takenNames=文件夹内已归档展示名） */}
    <ConfirmNamingDialog
      open={namingOpen}
      onOpenChange={setNamingOpen}
      title="上传命名确认"
      confirmLabel="确认上传"
      items={namingItems}
      takenNames={(fid) =>
        state.files
          .filter((f) => f.status === 'archived' && (f.parentId === fid || f.targetFolderId === fid))
          .map(displayNameOf)
      }
      onConfirm={confirmNaming}
    />
    </>
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
