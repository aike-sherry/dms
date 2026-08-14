/* 命名规则配置弹窗（PM TRANSFER 工具栏与目录创建弹窗「命名设置」共用）：
   模板输入 + 占位符胶囊（光标处插入）+ 实时预览 + 恢复默认 + 保存（setNamingTemplate 持久化，双端生效） */
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ModalHeader } from '@/components/common'
import { applyNamingTemplate, DEFAULT_NAMING_TEMPLATE } from '@/lib/smartDoc'
import { useStore } from '@/store'

export default function NamingRuleDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { state, dispatch } = useStore()
  const [tplDraft, setTplDraft] = useState('')
  const tplInputRef = useRef<HTMLInputElement>(null)

  /* 打开时载入当前模板 */
  useEffect(() => {
    if (open) setTplDraft(state.namingTemplate)
  }, [open, state.namingTemplate])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">命名规则</DialogTitle>
        <ModalHeader title="命名规则" onClose={() => onOpenChange(false)} />
        <div className="space-y-4 p-5">
          <p className="text-xs leading-5 text-gray-400">
            上传文件识别出文档类型后，按此模板自动生成规范文件名（执行端上传需先确认目标文档，PM
            上传直接套用）；未识别的文件保留原名。
          </p>
          <div>
            <div className="mb-1.5 text-xs font-medium text-gray-500">命名模板</div>
            <input
              ref={tplInputRef}
              value={tplDraft}
              onChange={(e) => setTplDraft(e.target.value)}
              placeholder="如：{项目编号}-{文档类型}-V{版本}（{日期}）"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none hover:border-teal-400 focus:border-teal-500"
            />
            {/* 占位符胶囊：点击在光标处插入 */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['项目编号', '文档类型', '版本', '日期', '研究中心'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    const el = tplInputRef.current
                    const token = `{${p}}`
                    if (!el) {
                      setTplDraft((t) => t + token)
                      return
                    }
                    const s = el.selectionStart ?? tplDraft.length
                    const e2 = el.selectionEnd ?? tplDraft.length
                    setTplDraft(tplDraft.slice(0, s) + token + tplDraft.slice(e2))
                    requestAnimationFrame(() => {
                      el.focus()
                      el.setSelectionRange(s + token.length, s + token.length)
                    })
                  }}
                  className="rounded-full bg-teal-50 px-2.5 py-1 text-xs text-teal-600 ring-1 ring-teal-100 transition-colors hover:bg-teal-100"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          {/* 实时预览：示例值渲染 */}
          <div className="rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
            <div className="text-xs text-gray-400">实时预览（示例：ON101CL01 / 知情同意书 / 1.0 / 2026-08-10 / 上海瑞金医院）</div>
            <div className="mt-1 text-sm font-medium break-all text-teal-600">
              {applyNamingTemplate(tplDraft, {
                projectNo: 'ON101CL01',
                docType: '知情同意书',
                version: '1.0',
                date: '2026-08-10',
                center: '上海瑞金医院',
              }) || '—'}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setTplDraft(DEFAULT_NAMING_TEMPLATE)}>
              恢复默认
            </Button>
            <Button
              size="sm"
              className="h-8 bg-teal-500 text-xs text-white hover:bg-teal-600"
              onClick={() => {
                dispatch({ type: 'setNamingTemplate', template: tplDraft })
                toast.success('命名规则已保存', { description: '上传文件将按新模板自动生成规范文件名' })
                onOpenChange(false)
              }}
            >
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
