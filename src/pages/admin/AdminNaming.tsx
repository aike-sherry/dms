import { useMemo, useRef, useState } from 'react'
import { Braces, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ModalHeader } from '@/components/CatalogDialog'
import { PageCard, DataTable, Th, Td, Tr, TealLink } from '@/components/common'
import { cn } from '@/lib/utils'
import {
  SKELETON_PLACEHOLDERS,
  SKELETON_SAMPLE_VARS,
  renderSkeleton,
  validateSkeleton,
} from '@/lib/namingSkeleton'
import { useStore, nextId, type DocType, type NamingTemplate } from '@/store'

/* ---------------- 占位符高亮渲染：骨架字符串中的 {占位符} 显示为 teal 芯片 ---------------- */
export function SkeletonText({ value, className }: { value: string; className?: string }) {
  const parts = value.split(/(\{[^}]*\})/g)
  return (
    <span className={cn('inline-flex flex-wrap items-center justify-center gap-1 break-all', className)}>
      {parts.map((p, i) =>
        /^\{[^}]*\}$/.test(p) ? (
          <span key={i} className="rounded bg-teal-50 px-1.5 py-0.5 font-mono text-[11px] text-teal-600 ring-1 ring-teal-100">
            {p}
          </span>
        ) : (
          <span key={i} className="font-mono text-xs text-gray-600">
            {p}
          </span>
        ),
      )}
    </span>
  )
}

const inputCls =
  'h-10 w-full rounded-lg border border-gray-200 bg-gray-50/60 px-3 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 hover:border-gray-300 focus:border-teal-500 focus:bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  )
}

/* ---------------- 骨架编辑弹窗（新增/编辑共用；占位符 chips 点击在光标处插入） ---------------- */
interface TplForm {
  name: string
  skeleton: string
  remark: string
  docTypeFilter: string[]
}

function TemplateDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  initial: TplForm
  onSubmit: (f: TplForm) => void
}) {
  const { state } = useStore()
  const [form, setForm] = useState<TplForm>(initial)
  const skelRef = useRef<HTMLInputElement>(null)
  /* 弹窗每次打开重置表单（open 变化时同步 initial） */
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setForm(initial)
  }

  const insertPlaceholder = (ph: string) => {
    const el = skelRef.current
    const token = `{${ph}}`
    if (!el) {
      setForm((f) => ({ ...f, skeleton: f.skeleton + token }))
      return
    }
    const s = el.selectionStart ?? form.skeleton.length
    const e = el.selectionEnd ?? s
    const next = form.skeleton.slice(0, s) + token + form.skeleton.slice(e)
    setForm((f) => ({ ...f, skeleton: next }))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(s + token.length, s + token.length)
    })
  }

  const err = validateSkeleton(form.skeleton)
  const toggleDocType = (id: string) =>
    setForm((f) => ({
      ...f,
      docTypeFilter: f.docTypeFilter.includes(id) ? f.docTypeFilter.filter((x) => x !== id) : [...f.docTypeFilter, id],
    }))

  const submit = () => {
    if (!form.name.trim()) {
      toast.warning('请填写骨架名称')
      return
    }
    if (err) {
      toast.warning('骨架语法有误', { description: err })
      return
    }
    onSubmit({ ...form, name: form.name.trim(), skeleton: form.skeleton.trim(), remark: form.remark.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <ModalHeader title={title} onClose={() => onOpenChange(false)} />
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <Field label="骨架名称 *">
              <input
                className={inputCls}
                placeholder="如：方案类文件命名"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field label="备注">
              <input
                className={inputCls}
                placeholder="适用场景说明（可选）"
                value={form.remark}
                onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="骨架字符串（用 - 分段，占位符用 {} 包裹）*">
            <input
              ref={skelRef}
              className={cn(inputCls, 'font-mono', err && form.skeleton && 'border-red-300')}
              placeholder="{试验编号}-{文件类型简称}-V{版本号}-{YYYYMMDD}"
              value={form.skeleton}
              onChange={(e) => setForm((f) => ({ ...f, skeleton: e.target.value }))}
            />
          </Field>
          {/* 占位符速查 chips：点击在光标处插入 */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-gray-500">可用占位符（点击插入）</span>
            <div className="flex flex-wrap gap-1.5">
              {SKELETON_PLACEHOLDERS.map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => insertPlaceholder(ph)}
                  className="rounded-full bg-teal-50 px-2.5 py-1 font-mono text-[11px] text-teal-600 ring-1 ring-teal-100 transition-colors hover:bg-teal-100"
                >
                  {`{${ph}}`}
                </button>
              ))}
            </div>
          </div>
          {/* 实时预览 */}
          <div className="rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
            <div className="text-xs text-gray-400">示例渲染预览</div>
            <div className="mt-1 text-center text-sm font-medium break-all text-teal-600">
              {err ? <span className="text-red-400">{err}</span> : renderSkeleton(form.skeleton, SKELETON_SAMPLE_VARS) || '—'}
            </div>
          </div>
          {/* 限定文档类型（字典筛选）：不勾=全部类型可选 */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-gray-500">
              限定文档类型（可选；勾选后该骨架目录下上传时类型下拉只显示这些类型）
            </span>
            <div className="flex flex-wrap gap-1.5">
              {state.docTypes.map((d) => {
                const on = form.docTypeFilter.includes(d.id)
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDocType(d.id)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] ring-1 transition-colors',
                      on
                        ? 'bg-teal-500 text-white ring-teal-500'
                        : 'bg-white text-gray-500 ring-gray-200 hover:bg-gray-50',
                    )}
                  >
                    {d.code}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" className="bg-teal-500 text-white hover:bg-teal-600" onClick={submit}>
            保存
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- admin 命名骨架库 + 文档类型字典 ---------------- */
export default function AdminNaming() {
  const { state, dispatch } = useStore()
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<NamingTemplate | null>(null)
  /* 字典弹窗 */
  const [dtOpen, setDtOpen] = useState(false)
  const [dtEdit, setDtEdit] = useState<DocType | null>(null)
  const [dtForm, setDtForm] = useState({ code: '', name: '', category: '' })

  const tplById = useMemo(() => new Map(state.docTypes.map((d) => [d.id, d])), [state.docTypes])

  const toggleStatus = (t: NamingTemplate) => {
    const next = t.status === '启用' ? '停用' : '启用'
    dispatch({ type: 'updateNamingTemplate', id: t.id, patch: { status: next } })
    toast.success(`骨架「${t.name}」已${next}`, {
      description: next === '停用' ? '停用后 PM 绑定目录时不再可选；已绑定目录不受影响' : 'PM 绑定目录时可选',
    })
  }

  const submitAdd = (f: TplForm) => {
    const t: NamingTemplate = { id: nextId('nt'), ...f, status: '启用', remark: f.remark || undefined, docTypeFilter: f.docTypeFilter.length > 0 ? f.docTypeFilter : undefined }
    dispatch({ type: 'addNamingTemplate', template: t })
    setAddOpen(false)
    toast.success(`已新增骨架「${t.name}」`, { description: 'PM 现在可将目录绑定到该骨架' })
  }
  const submitEdit = (f: TplForm) => {
    if (!editTarget) return
    dispatch({
      type: 'updateNamingTemplate',
      id: editTarget.id,
      patch: { name: f.name, skeleton: f.skeleton, remark: f.remark || undefined, docTypeFilter: f.docTypeFilter.length > 0 ? f.docTypeFilter : undefined },
    })
    setEditTarget(null)
    toast.success(`骨架「${f.name}」已保存`, { description: '仅对后续上传生效；存量文件名不变' })
  }

  const submitDocType = () => {
    const code = dtForm.code.trim()
    const name = dtForm.name.trim()
    const category = dtForm.category.trim()
    if (!code || !name || !category) {
      toast.warning('请填写简称、全称与分类')
      return
    }
    const dup = state.docTypes.some((d) => d.id !== dtEdit?.id && (d.code === code || d.name === name))
    if (dup) {
      toast.warning('已存在相同简称或全称的类型')
      return
    }
    if (dtEdit) {
      dispatch({ type: 'updateDocType', id: dtEdit.id, patch: { code, name, category } })
      toast.success(`文档类型「${code}」已保存`)
    } else {
      dispatch({ type: 'addDocType', docType: { id: nextId('dt'), code, name, category } })
      toast.success(`已新增文档类型「${code}」`)
    }
    setDtOpen(false)
    setDtEdit(null)
  }
  const removeDocType = (d: DocType) => {
    const usedBy = state.namingTemplates.filter((t) => t.docTypeFilter?.includes(d.id))
    if (usedBy.length > 0) {
      toast.warning('该类型被骨架引用，无法删除', { description: usedBy.map((t) => t.name).join('、') })
      return
    }
    dispatch({ type: 'removeDocType', id: d.id })
    toast.success(`已删除文档类型「${d.code}」`)
  }

  const emptyTpl: TplForm = { name: '', skeleton: '', remark: '', docTypeFilter: [] }

  return (
    <div className="space-y-5">
      {/* ===== 命名范式骨架库 ===== */}
      <PageCard
        title="命名范式骨架库"
        extra={
          <Button size="sm" className="gap-1.5 bg-teal-500 text-white hover:bg-teal-600" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> 新增骨架
          </Button>
        }
      >
        <DataTable>
          <thead>
            <tr>
              <Th className="w-44">骨架名称</Th>
              <Th>骨架（占位符高亮）</Th>
              <Th className="w-56">示例渲染</Th>
              <Th className="w-32">限定类型</Th>
              <Th className="w-20">状态</Th>
              <Th className="w-40">备注</Th>
              <Th sortable={false} className="w-28">操作</Th>
            </tr>
          </thead>
          <tbody>
            {state.namingTemplates.map((t) => (
              <Tr key={t.id}>
                <Td className="font-medium text-gray-800">{t.name}</Td>
                <Td>
                  <SkeletonText value={t.skeleton} />
                </Td>
                <Td className="text-xs break-all text-teal-600">{renderSkeleton(t.skeleton, SKELETON_SAMPLE_VARS)}</Td>
                <Td className="text-xs text-gray-500">
                  {t.docTypeFilter && t.docTypeFilter.length > 0
                    ? t.docTypeFilter.map((id) => tplById.get(id)?.code ?? id).join('、')
                    : '全部'}
                </Td>
                <Td>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs',
                      t.status === '启用' ? 'bg-teal-50 text-teal-600 ring-1 ring-teal-100' : 'bg-gray-100 text-gray-400',
                    )}
                  >
                    {t.status}
                  </span>
                </Td>
                <Td className="text-xs text-gray-500">{t.remark ?? '—'}</Td>
                <Td>
                  <div className="flex items-center justify-center gap-2.5 whitespace-nowrap">
                    <TealLink onClick={() => setEditTarget(t)}>编辑</TealLink>
                    <TealLink onClick={() => toggleStatus(t)}>{t.status === '启用' ? '停用' : '启用'}</TealLink>
                  </div>
                </Td>
              </Tr>
            ))}
            {state.namingTemplates.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                  暂无骨架，点右上角「新增骨架」
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </PageCard>

      {/* ===== 文档类型字典 ===== */}
      <PageCard
        title="文档类型字典"
        extra={
          <Button
            size="sm"
            className="gap-1.5 bg-teal-500 text-white hover:bg-teal-600"
            onClick={() => {
              setDtEdit(null)
              setDtForm({ code: '', name: '', category: '' })
              setDtOpen(true)
            }}
          >
            <Plus className="h-4 w-4" /> 新增类型
          </Button>
        }
      >
        <DataTable>
          <thead>
            <tr>
              <Th className="w-36">简称（命名取值）</Th>
              <Th>全称</Th>
              <Th className="w-36">分类</Th>
              <Th sortable={false} className="w-28">操作</Th>
            </tr>
          </thead>
          <tbody>
            {state.docTypes.map((d) => (
              <Tr key={d.id}>
                <Td className="font-medium text-gray-800">{d.code}</Td>
                <Td className="text-gray-600">{d.name}</Td>
                <Td>
                  <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs text-cyan-600 ring-1 ring-cyan-100">{d.category}</span>
                </Td>
                <Td>
                  <div className="flex items-center justify-center gap-2.5">
                    <button
                      type="button"
                      title="编辑"
                      onClick={() => {
                        setDtEdit(d)
                        setDtForm({ code: d.code, name: d.name, category: d.category })
                        setDtOpen(true)
                      }}
                      className="text-gray-300 transition-colors hover:text-teal-500"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="删除"
                      onClick={() => removeDocType(d)}
                      className="text-gray-300 transition-colors hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </PageCard>

      {/* 骨架弹窗 */}
      <TemplateDialog open={addOpen} onOpenChange={setAddOpen} title="新增命名骨架" initial={emptyTpl} onSubmit={submitAdd} />
      {editTarget && (
        <TemplateDialog
          open={!!editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          title={`编辑骨架 · ${editTarget.name}`}
          initial={{
            name: editTarget.name,
            skeleton: editTarget.skeleton,
            remark: editTarget.remark ?? '',
            docTypeFilter: editTarget.docTypeFilter ?? [],
          }}
          onSubmit={submitEdit}
        />
      )}

      {/* 字典弹窗 */}
      <Dialog open={dtOpen} onOpenChange={setDtOpen}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-md">
          <DialogTitle className="sr-only">{dtEdit ? '编辑文档类型' : '新增文档类型'}</DialogTitle>
          <ModalHeader title={dtEdit ? `编辑文档类型 · ${dtEdit.code}` : '新增文档类型'} onClose={() => setDtOpen(false)} />
          <div className="space-y-4 p-6">
            <Field label="简称 *（作为 {文件类型简称} 的命名取值）">
              <input className={inputCls} placeholder="如：方案" value={dtForm.code} onChange={(e) => setDtForm((f) => ({ ...f, code: e.target.value }))} />
            </Field>
            <Field label="全称 *">
              <input className={inputCls} placeholder="如：临床试验方案" value={dtForm.name} onChange={(e) => setDtForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="分类 *（如 方案/伦理/SAE/会议纪要）">
              <input className={inputCls} placeholder="如：SAE" value={dtForm.category} onChange={(e) => setDtForm((f) => ({ ...f, category: e.target.value }))} />
            </Field>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
            <Button variant="outline" size="sm" onClick={() => setDtOpen(false)}>
              取消
            </Button>
            <Button size="sm" className="gap-1 bg-teal-500 text-white hover:bg-teal-600" onClick={submitDocType}>
              <Braces className="h-3.5 w-3.5" /> 保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
