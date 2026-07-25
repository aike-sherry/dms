import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CircleCheck, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileTypeIcon } from '@/components/common'
import { useStore, type TmfFile } from '@/store'
import { analyzeName, applyFixes, findIssues, suggestName } from '@/lib/smartDoc'

export type SmartMode = 'rename' | 'correct'

/** 智能命名 / 智能纠错弹窗：真实改写文件名，归档前的规范化工序 */
export default function SmartProcessDialog({
  target,
  onClose,
}: {
  target: { file: TmfFile; mode: SmartMode } | null
  onClose: () => void
}) {
  const { state, dispatch } = useStore()
  const file = target?.file ?? null
  const mode = target?.mode ?? 'rename'
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (file) setDraft(mode === 'rename' ? suggestName(file.name) : file.name)
  }, [file, mode])

  /* 同项目其他文件（重名检测基准，排除自身与文件夹） */
  const siblingNames = useMemo(
    () =>
      file
        ? state.files
            .filter((f) => f.projectNo === file.projectNo && f.id !== file.id && f.kind !== 'folder')
            .map((f) => f.name)
        : [],
    [state.files, file],
  )

  const analysis = useMemo(() => (file ? analyzeName(file.name) : null), [file])
  const issues = useMemo(() => (file ? findIssues(file.name, siblingNames) : []), [file, siblingNames])
  const fixedName = useMemo(() => (file ? applyFixes(file.name, siblingNames) : ''), [file, siblingNames])

  if (!file || !analysis) return null

  const applyRename = () => {
    const name = draft.trim()
    if (!name) {
      toast.warning('文件名不能为空')
      return
    }
    dispatch({ type: 'renameFile', id: file.id, name })
    toast.success('智能命名完成', { description: `已命名为「${name}」，可点击归档进入 STUDY TMF` })
    onClose()
  }

  const applyCorrect = () => {
    dispatch({ type: 'renameFile', id: file.id, name: fixedName })
    toast.success(`智能纠错完成，已修复 ${issues.length} 项问题`, { description: `已命名为「${fixedName}」` })
    onClose()
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            {mode === 'rename' ? (
              <>
                <Sparkles className="h-4 w-4 text-teal-600" /> 智能命名
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 text-teal-600" /> 智能纠错
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* 当前文件 */}
        <div className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
          <FileTypeIcon kind={file.kind} />
          <div className="min-w-0">
            <p className="truncate text-sm text-gray-700">{file.name}</p>
            <p className="text-xs text-gray-400">
              {file.projectNo} · {file.size} · 上传于 {file.uploadDate}
            </p>
          </div>
        </div>

        {mode === 'rename' ? (
          <div className="space-y-4">
            {/* 识别结果 */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400">识别结果：</span>
              {analysis.matched ? (
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs text-teal-700 ring-1 ring-teal-200">
                  文档类型：{analysis.docType}
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700 ring-1 ring-amber-200">
                  未识别文档类型，将保留原名
                </span>
              )}
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700 ring-1 ring-blue-200">
                版本：{analysis.version ?? 'V1.0（补全）'}
              </span>
              {analysis.date && (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 ring-1 ring-gray-200">
                  日期：{analysis.date}
                </span>
              )}
            </div>

            {/* 命名预览 */}
            <div className="space-y-2">
              <p className="text-xs text-gray-400">规范命名（可手动调整）：</p>
              <div className="flex items-center gap-3">
                <span className="max-w-[180px] truncate text-sm text-gray-400 line-through decoration-gray-300">
                  {file.name}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-teal-500" />
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyRename()}
                  className="h-9 flex-1 rounded-md border border-teal-300 px-3 text-sm text-gray-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>
              <p className="text-xs text-gray-400">命名规范：文档类型 V版本号（日期），符合 TMF 目录归档要求</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose}>
                取消
              </Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={applyRename}>
                应用命名
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {issues.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3">
                <CircleCheck className="h-4.5 w-4.5 shrink-0 text-emerald-600" />
                <p className="text-sm text-emerald-700">未发现问题，文件名符合 TMF 命名规范，可直接归档。</p>
              </div>
            ) : (
              <>
                <ul className="space-y-2">
                  {issues.map((it) => (
                    <li
                      key={it.code}
                      className="flex items-start gap-2.5 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5"
                    >
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <span className="text-sm text-amber-800">{it.label}</span>
                    </li>
                  ))}
                </ul>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <p className="text-xs text-gray-400">修复后：</p>
                  <p className="mt-0.5 text-sm font-medium text-teal-700">{fixedName}</p>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onClose}>
                取消
              </Button>
              {issues.length > 0 && (
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={applyCorrect}>
                  一键修复（{issues.length} 项）
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
