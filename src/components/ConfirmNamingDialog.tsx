/* R39 收敛 C1：PM 侧骨架命名确认弹窗（与 CRA 上传向导同款交互）。
   调用场景：TRANSFER 归档 / TMF 钻取上传——目标文件夹已绑定（含继承）启用中骨架的文件，
   确认前逐行给出骨架建议名：试验编号/中心/日期自动带入，类型/版本/状态下拉补选，实时预览
   可手动微调覆盖，多行时顶部「应用到全部」（跳过已微调行），重名自动追加（2）（3）。
   本组件只负责「确认出最终名」，落库与审计由调用方完成（onConfirm 回传逐行结果） */
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ToolbarSelect } from '@/components/common'
import { ModalHeader } from '@/components/common'
import { cn } from '@/lib/utils'
import { analyzeName } from '@/lib/smartDoc'
import { renderSkeleton, appendDupSuffix, VERSION_OPTIONS, DOC_STATUS_OPTIONS } from '@/lib/namingSkeleton'
import { useStore, todayStr, type TmfFile, type NamingTemplate } from '@/store'

/** 待确认项：id 由调用方自定（结果按 id 回传）；from=当前名/原文件名（展示 + originalFilename 兜底） */
export interface NamingJobItem {
  id: string
  from: string
  projectNo: string
  center: string
  /** 目标文件夹（绑定持有人或其子孙） */
  folderId: string
  folderName: string
  eff: { template: NamingTemplate; holder: TmfFile; inherited: boolean }
}

/** 逐行确认结果：action=创建命名 / 重名追加（oldValue=期望名、newValue 即 finalName） */
export interface NamingJobResult {
  id: string
  finalName: string
  docType: string
  versionNo: string
  docStatus: string
  action: '创建命名' | '重名追加'
  oldValue: string
}

interface Row {
  docType: string
  versionNo: string
  docStatus: string
  override: string
  dirty: boolean
  touched: boolean
  aiFilled: boolean
}

export default function ConfirmNamingDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  items,
  takenNames,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  confirmLabel: string
  items: NamingJobItem[]
  /** 目标文件夹内现存展示名（重名避让基准；调用方应排除本次任务自身条目） */
  takenNames: (folderId: string) => string[]
  onConfirm: (results: NamingJobResult[]) => void
}) {
  const { state } = useStore()
  const [wiz, setWiz] = useState<Record<number, Row>>({})
  const [bulk, setBulk] = useState({ docType: '', versionNo: '', docStatus: '' })

  /* 目标文件夹现存名种子（打开时取一次；确认时在本批内继续累积避让） */
  const seeds = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const it of items) {
      if (!m.has(it.folderId)) m.set(it.folderId, new Set(takenNames(it.folderId)))
    }
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items])

  /* 类型下拉选项：骨架 docTypeFilter 限定时只列限定类型，否则全字典 */
  const docTypeChoicesFor = (tpl: NamingTemplate) => {
    const filter = tpl.docTypeFilter
    return filter && filter.length > 0 ? state.docTypes.filter((d) => filter.includes(d.id)) : state.docTypes
  }

  /* 打开/条目变化时初始化行：AI 预填开关开启时按原文件名关键词预选类型（仅预填不落名） */
  useEffect(() => {
    if (!open) return
    const next: Record<number, Row> = {}
    items.forEach((it, i) => {
      const a = analyzeName(it.from)
      const choices = docTypeChoicesFor(it.eff.template)
      const hit =
        state.aiPrefill && a.matched
          ? choices.find((d) => d.code.includes(a.docType) || a.docType.includes(d.code) || d.name.includes(a.docType))
          : undefined
      next[i] = { docType: hit?.code ?? '', versionNo: '1.0', docStatus: '草稿', override: '', dirty: false, touched: false, aiFilled: !!hit }
    })
    setWiz(next)
    setBulk({ docType: '', versionNo: '', docStatus: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, items])

  const patchRow = (i: number, patch: Partial<Row>) =>
    setWiz((s) => (s[i] ? { ...s, [i]: { ...s[i], ...patch, touched: true, aiFilled: false } } : s))

  const render = (it: NamingJobItem, w: Row) =>
    renderSkeleton(it.eff.template.skeleton, {
      试验编号: it.projectNo,
      中心编号: it.center,
      YYYYMMDD: todayStr().replaceAll('-', ''),
      文件类型简称: w.docType,
      版本号: w.versionNo,
      文档状态: w.docStatus,
      SAE序号: '',
      访视编号: '',
    })

  /* 批量「应用到全部」：类型取各行骨架限定并集；跳过已微调行；类型越骨架限定跳过该字段 */
  const bulkTypeOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const it of items) for (const d of docTypeChoicesFor(it.eff.template)) if (!map.has(d.code)) map.set(d.code, d.name)
    return [...map.entries()].map(([code, name]) => ({ label: `${code}｜${name}`, value: code }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, state.docTypes])
  const applyBulk = () => {
    if (!bulk.docType && !bulk.versionNo && !bulk.docStatus) {
      toast.warning('请先选择要套用的类型 / 版本 / 状态')
      return
    }
    let applied = 0
    let skippedTouched = 0
    let skippedType = 0
    setWiz((s) => {
      const next = { ...s }
      items.forEach((it, i) => {
        const row = next[i]
        if (!row) return
        if (row.touched) {
          skippedTouched++
          return
        }
        let dt = row.docType
        if (bulk.docType) {
          if (docTypeChoicesFor(it.eff.template).some((d) => d.code === bulk.docType)) dt = bulk.docType
          else skippedType++
        }
        next[i] = { ...row, docType: dt, versionNo: bulk.versionNo || row.versionNo, docStatus: bulk.docStatus || row.docStatus, aiFilled: dt === row.docType ? row.aiFilled : false }
        applied++
      })
      return next
    })
    toast.success(`已套用到 ${applied} 行`, {
      description:
        [skippedTouched > 0 ? `${skippedTouched} 行已手动微调，保持不动` : '', skippedType > 0 ? `${skippedType} 行的骨架限定类型不含所选类型，类型未套用` : '']
          .filter(Boolean)
          .join('；') || undefined,
    })
  }

  const allReady = items.length > 0 && items.every((_, i) => !!wiz[i]?.docType)

  const confirm = () => {
    if (!allReady) return
    /* 确认时逐行避让：种子 + 本批已确定名（同文件夹内互相避让（2）（3）） */
    const taken = new Map<string, Set<string>>()
    const takenOf = (fid: string) => {
      let s = taken.get(fid)
      if (!s) {
        s = new Set(seeds.get(fid) ?? [])
        taken.set(fid, s)
      }
      return s
    }
    const results: NamingJobResult[] = items.map((it, i) => {
      const w = wiz[i]
      const rendered = render(it, w)
      const want = ((w.dirty ? w.override.trim() : rendered) || rendered || it.from).trim()
      const finalName = appendDupSuffix(want, takenOf(it.folderId))
      takenOf(it.folderId).add(finalName)
      return {
        id: it.id,
        finalName,
        docType: w.docType,
        versionNo: w.versionNo,
        docStatus: w.docStatus,
        action: finalName !== want ? ('重名追加' as const) : ('创建命名' as const),
        oldValue: finalName !== want ? want : '',
      }
    })
    onConfirm(results)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <ModalHeader title={title} onClose={() => onOpenChange(false)} />
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-6">
          <p className="text-xs leading-5 text-gray-400">
            以下文件的目标文件夹已绑定命名骨架——请逐行确认规范文件名（类型/版本/状态可补选，预览可手动微调）；
            确认后才落库并写入命名审计。未绑定骨架的文件不受影响，按原流程处理。
          </p>
          {/* 批量操作条：多行时一键套用类型/版本/状态到未手动微调的行 */}
          {items.length >= 2 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 ring-1 ring-gray-100">
              <span className="text-xs font-medium whitespace-nowrap text-gray-500">应用到全部：</span>
              <ToolbarSelect
                value={bulk.docType}
                onChange={(v) => setBulk((b) => ({ ...b, docType: v }))}
                options={[{ label: '类型（不套用）', value: '' }, ...bulkTypeOptions]}
                className="w-44 [&>select]:w-full"
              />
              <ToolbarSelect
                value={bulk.versionNo}
                onChange={(v) => setBulk((b) => ({ ...b, versionNo: v }))}
                options={[{ label: '版本（不套用）', value: '' }, ...VERSION_OPTIONS.map((v) => ({ label: `V${v}`, value: v }))]}
                className="w-28 [&>select]:w-full"
              />
              <ToolbarSelect
                value={bulk.docStatus}
                onChange={(v) => setBulk((b) => ({ ...b, docStatus: v }))}
                options={[{ label: '状态（不套用）', value: '' }, ...DOC_STATUS_OPTIONS.map((s) => ({ label: s, value: s }))]}
                className="w-28 [&>select]:w-full"
              />
              <Button size="sm" className="h-7 bg-teal-500 px-3 text-xs text-white hover:bg-teal-600" onClick={applyBulk}>
                套用
              </Button>
              <span className="text-[11px] text-gray-400">已手动微调的行保持不动</span>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-gray-100">
            {items.map((it, i) => {
              const w = wiz[i]
              if (!w) return null
              const preview = w.dirty ? w.override : render(it, w)
              const dupWarn = !!preview && !!seeds.get(it.folderId)?.has(preview)
              return (
                <div key={it.id} className="border-b border-gray-50 px-4 py-3 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1 truncate text-xs text-gray-500" title={it.from}>
                      {it.from}
                    </div>
                    <span className="shrink-0 text-[11px] text-gray-400">→ {it.folderName}</span>
                    <span
                      title={it.eff.inherited ? `骨架继承自目录：${it.eff.holder.name}` : '该目录已绑定命名骨架'}
                      className="shrink-0 cursor-help rounded-full bg-teal-50 px-2 py-0.5 text-[11px] whitespace-nowrap text-teal-600 ring-1 ring-teal-100"
                    >
                      骨架·{it.eff.template.name}
                      {it.eff.inherited ? '（继承）' : ''}
                    </span>
                  </div>
                  <div className="mt-2 space-y-2 rounded-lg bg-teal-50/40 p-3 ring-1 ring-teal-100/60">
                    <div className="flex flex-wrap items-center gap-2">
                      <ToolbarSelect
                        value={w.docType}
                        onChange={(v) => patchRow(i, { docType: v })}
                        options={[
                          { label: '文档类型 *', value: '' },
                          ...docTypeChoicesFor(it.eff.template).map((d) => ({ label: `${d.code}｜${d.name}`, value: d.code })),
                        ]}
                        className="w-44 [&>select]:w-full"
                      />
                      {w.aiFilled && w.docType && (
                        <span
                          title="AI 按原文件名关键词预选的类型，可改选；确认前不会落地文件名"
                          className="cursor-help rounded-full bg-violet-50 px-2 py-0.5 text-[10px] whitespace-nowrap text-violet-600 ring-1 ring-violet-100"
                        >
                          AI 预填
                        </span>
                      )}
                      <ToolbarSelect
                        value={w.versionNo}
                        onChange={(v) => patchRow(i, { versionNo: v })}
                        options={VERSION_OPTIONS.map((v) => ({ label: `V${v}`, value: v }))}
                        className="w-24 [&>select]:w-full"
                      />
                      <ToolbarSelect
                        value={w.docStatus}
                        onChange={(v) => patchRow(i, { docStatus: v })}
                        options={[...DOC_STATUS_OPTIONS]}
                        className="w-24 [&>select]:w-full"
                      />
                      <span className="text-[11px] text-gray-400">试验编号 / 中心 / 日期已自动带入</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-[11px] text-gray-400">文件名预览</span>
                      <input
                        value={preview}
                        onChange={(e) => patchRow(i, { override: e.target.value, dirty: true })}
                        title="可手动修改；确认后以修改内容为准"
                        className={cn(
                          'h-8 min-w-0 flex-1 rounded-md border px-2 text-xs outline-none focus:ring-2',
                          w.dirty
                            ? 'border-amber-300 bg-amber-50/50 text-amber-700 focus:ring-amber-100'
                            : 'border-teal-200 bg-white font-medium text-teal-600 focus:ring-teal-100',
                        )}
                      />
                      {w.dirty && (
                        <button
                          type="button"
                          onClick={() => patchRow(i, { override: '', dirty: false })}
                          className="shrink-0 text-[11px] text-teal-500 hover:underline"
                        >
                          恢复骨架
                        </button>
                      )}
                    </div>
                    {!w.docType && <div className="text-[11px] text-amber-500">请选择文档类型后才能确认</div>}
                    {dupWarn && <div className="text-[11px] text-amber-500">目标文件夹内已存在同名文件，确认时将自动追加（2）</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <span className={cn('text-xs', allReady ? 'text-gray-300' : 'text-amber-500')}>
            {allReady ? `共 ${items.length} 个文件待确认` : '请为每个文件选择文档类型后才能确认'}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button size="sm" disabled={!allReady} className="h-8 bg-teal-500 text-xs text-white hover:bg-teal-600 disabled:opacity-40" onClick={confirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
