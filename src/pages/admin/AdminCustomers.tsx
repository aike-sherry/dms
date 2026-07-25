import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ModalHeader } from '@/components/CatalogDialog'
import { PageCard, DataTable, Th, Td, Tr, SearchInput, ToolbarSelect } from '@/components/common'
import { projectOptions } from '@/data/mock'
import { useStore, nextId, todayStr, type Customer } from '@/store'
import { cn } from '@/lib/utils'

const STATUS_BADGE: Record<Customer['status'], string> = {
  合作中: 'bg-teal-50 text-teal-600',
  暂停: 'bg-amber-50 text-amber-600',
  已结束: 'bg-gray-100 text-gray-400',
}

interface FormState {
  name: string
  contact: string
  phone: string
  projects: string[]
  status: Customer['status']
  note: string
}

const emptyForm: FormState = { name: '', contact: '', phone: '', projects: [], status: '合作中', note: '' }

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

export default function AdminCustomers() {
  const { state, dispatch } = useStore()
  const [kw, setKw] = useState('')
  const [statusFilter, setStatusFilter] = useState('全部')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const rows = useMemo(
    () =>
      state.customers.filter(
        (c) =>
          (statusFilter === '全部' || c.status === statusFilter) &&
          (!kw || c.name.includes(kw) || c.contact.includes(kw) || c.projects.some((p) => p.includes(kw))),
      ),
    [state.customers, kw, statusFilter],
  )

  const toggleProject = (p: string) =>
    setForm((f) => ({
      ...f,
      projects: f.projects.includes(p) ? f.projects.filter((x) => x !== p) : [...f.projects, p],
    }))

  const openAdd = () => {
    setForm(emptyForm)
    setAddOpen(true)
  }

  const openEdit = (c: Customer) => {
    setForm({
      name: c.name,
      contact: c.contact,
      phone: c.phone,
      projects: [...c.projects],
      status: c.status,
      note: c.note ?? '',
    })
    setEditTarget(c)
  }

  const valid = () => {
    if (!form.name.trim() || !form.contact.trim()) {
      toast.error('请填写客户名称与联系人')
      return false
    }
    return true
  }

  const submitAdd = () => {
    if (!valid()) return
    const c: Customer = {
      id: nextId('cu'),
      name: form.name.trim(),
      contact: form.contact.trim(),
      phone: form.phone.trim(),
      projects: form.projects,
      status: form.status,
      createdAt: todayStr(),
      note: form.note.trim() || undefined,
    }
    dispatch({ type: 'addCustomer', customer: c })
    setAddOpen(false)
    toast.success(`已新增客户「${c.name}」`)
  }

  const submitEdit = () => {
    if (!editTarget || !valid()) return
    dispatch({
      type: 'updateCustomer',
      id: editTarget.id,
      patch: {
        name: form.name.trim(),
        contact: form.contact.trim(),
        phone: form.phone.trim(),
        projects: form.projects,
        status: form.status,
        note: form.note.trim() || undefined,
      },
    })
    setEditTarget(null)
    toast.success('客户信息已更新')
  }

  const remove = (c: Customer) => {
    if (!window.confirm(`确定删除客户「${c.name}」吗？此操作不可恢复。`)) return
    dispatch({ type: 'removeCustomer', id: c.id })
    toast.success(`已删除客户「${c.name}」`)
  }

  const formDialog = (open: boolean, onClose: () => void, title: string, onSubmit: () => void) => (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <ModalHeader title={title} onClose={onClose} />
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="客户名称">
              <input
                className={inputCls}
                value={form.name}
                placeholder="如 恒瑞医药"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field label="联系人">
              <input
                className={inputCls}
                value={form.contact}
                placeholder="如 陈立"
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              />
            </Field>
            <Field label="联系电话">
              <input
                className={inputCls}
                value={form.phone}
                placeholder="如 138-0000-0000"
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </Field>
            <Field label="合作状态">
              <ToolbarSelect
                className="w-full"
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v as Customer['status'] }))}
                options={['合作中', '暂停', '已结束']}
              />
            </Field>
          </div>
          <Field label="合作项目（可多选）">
            <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
              {projectOptions.map((p) => {
                const on = form.projects.includes(p.value)
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => toggleProject(p.value)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs transition-all',
                      on
                        ? 'border-teal-500 bg-teal-500 text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-teal-300 hover:text-teal-600',
                    )}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="备注">
            <textarea
              className="min-h-20 w-full rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 hover:border-gray-300 focus:border-teal-500 focus:bg-white"
              value={form.note}
              placeholder="选填"
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </Field>
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button variant="outline" size="sm" className="h-9 px-5 text-xs" onClick={onClose}>
              取消
            </Button>
            <Button size="sm" className="h-9 bg-teal-500 px-5 text-xs text-white hover:bg-teal-600" onClick={onSubmit}>
              确认
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )

  return (
    <PageCard
      title="客户管理"
      extra={
        <Button size="sm" className="h-9 gap-1.5 bg-teal-500 text-xs text-white hover:bg-teal-600" onClick={openAdd}>
          <Plus className="h-4 w-4" /> 新建客户
        </Button>
      }
    >
      {/* 工具栏 */}
      <div className="mb-4 flex items-center gap-3">
        <SearchInput value={kw} onChange={setKw} placeholder="搜索客户 / 联系人 / 项目编号" className="w-64" />
        <ToolbarSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={['全部', '合作中', '暂停', '已结束']}
        />
      </div>

      <DataTable>
        <thead>
          <tr>
            <Th sortable={false}>客户名称</Th>
            <Th sortable={false}>联系人</Th>
            <Th sortable={false}>联系电话</Th>
            <Th sortable={false}>合作项目</Th>
            <Th sortable={false}>状态</Th>
            <Th sortable={false}>创建日期</Th>
            <Th sortable={false}>备注</Th>
            <Th sortable={false}>操作</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <Tr key={c.id}>
              <Td className="font-medium text-gray-700">{c.name}</Td>
              <Td>{c.contact}</Td>
              <Td className="font-mono text-xs">{c.phone || '—'}</Td>
              <Td>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {c.projects.length > 0
                    ? c.projects.map((p) => (
                        <span key={p} className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] text-teal-600">
                          {p}
                        </span>
                      ))
                    : '—'}
                </div>
              </Td>
              <Td>
                <span className={cn('rounded-full px-2.5 py-1 text-xs', STATUS_BADGE[c.status])}>{c.status}</span>
              </Td>
              <Td className="text-xs">{c.createdAt}</Td>
              <Td className="max-w-40 truncate text-xs text-gray-400">{c.note ?? '—'}</Td>
              <Td>
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    title="编辑"
                    onClick={() => openEdit(c)}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-teal-50 hover:text-teal-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="删除"
                    onClick={() => remove(c)}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Td>
            </Tr>
          ))}
          {rows.length === 0 && (
            <Tr>
              <Td className="py-10 text-gray-400">未找到匹配客户</Td>
              <Td />
              <Td />
              <Td />
              <Td />
              <Td />
              <Td />
              <Td />
            </Tr>
          )}
        </tbody>
      </DataTable>

      {formDialog(addOpen, () => setAddOpen(false), '新建客户', submitAdd)}
      {formDialog(!!editTarget, () => setEditTarget(null), '编辑客户', submitEdit)}
    </PageCard>
  )
}
