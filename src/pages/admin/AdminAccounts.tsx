import { useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  KeyRound,
  CheckCircle2,
  Eye,
  LogIn,
  UploadCloud,
  Snowflake,
  Power,
  Trash2,
  Users,
  UserCheck,
  UserRoundX,
} from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ModalHeader } from '@/components/CatalogDialog'
import { PageCard, DataTable, Th, Td, Tr, SearchInput, ToolbarSelect, FileTypeIcon, NameTh } from '@/components/common'
import { useStore, nextId, todayStr, type Account, type FileStatus, type Role } from '@/store'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<Role, string> = { pm: '管理人员', executor: '执行人员', admin: '系统管理员' }
const ROLE_BADGE: Record<Role, string> = {
  pm: 'bg-teal-50 text-teal-600',
  executor: 'bg-orange-50 text-orange-600',
  admin: 'bg-violet-50 text-violet-600',
}

type AccountStatus = Account['status']
const STATUS_BADGE: Record<AccountStatus, string> = {
  激活: 'bg-teal-50 text-teal-600',
  冻结: 'bg-amber-50 text-amber-600',
  关闭: 'bg-gray-100 text-gray-400',
}

/** 文件状态展示（账号下钻·上传足迹） */
const FILE_STATUS_LABEL: Record<FileStatus, string> = {
  uploaded: '已上传',
  pending: '审核中',
  rejected: '驳回',
  archived: '归档',
}
const FILE_STATUS_BADGE: Record<FileStatus, string> = {
  uploaded: 'bg-blue-50 text-blue-600',
  pending: 'bg-amber-50 text-amber-600',
  rejected: 'bg-rose-50 text-rose-500',
  archived: 'bg-teal-50 text-teal-600',
}

interface FormState {
  username: string
  name: string
  role: Role
  center: string
  sponsor: string
  email: string
  phone: string
  password: string
}

const emptyForm: FormState = {
  username: '',
  name: '',
  role: 'executor',
  center: '',
  sponsor: '',
  email: '',
  phone: '',
  password: '123456',
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

export default function AdminAccounts() {
  const { state, dispatch } = useStore()
  const [kw, setKw] = useState('')
  const [roleFilter, setRoleFilter] = useState('全部')
  const [statusFilter, setStatusFilter] = useState<'全部' | AccountStatus>('全部')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Account | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [drillAccount, setDrillAccount] = useState<Account | null>(null)

  /* ---- 账户分布统计 ---- */
  const stats = useMemo(() => {
    const active = state.accounts.filter((a) => a.status === '激活').length
    const frozen = state.accounts.filter((a) => a.status === '冻结').length
    const closed = state.accounts.filter((a) => a.status === '关闭').length
    return {
      total: state.accounts.length + state.accountDeleted,
      active,
      frozen,
      closedDeleted: closed + state.accountDeleted,
    }
  }, [state.accounts, state.accountDeleted])

  const rows = useMemo(
    () =>
      state.accounts.filter(
        (a) =>
          (roleFilter === '全部' || a.role === roleFilter) &&
          (statusFilter === '全部' || a.status === statusFilter) &&
          (!kw || a.username.includes(kw) || a.name.includes(kw) || (a.center ?? '').includes(kw)),
      ),
    [state.accounts, kw, roleFilter, statusFilter],
  )

  /* ---- 账号下钻：登录流水 + 上传足迹 ---- */
  const drillLogs = useMemo(() => {
    if (!drillAccount) return []
    return state.loginLogs.filter((l) => l.username === drillAccount.username)
  }, [state.loginLogs, drillAccount])

  const drillFiles = useMemo(() => {
    if (!drillAccount) return []
    return state.files
      .filter((f) => f.uploader === drillAccount.name)
      .slice()
      .sort((a, b) => b.uploadDate.localeCompare(a.uploadDate))
  }, [state.files, drillAccount])

  const drillStats = useMemo(() => {
    if (!drillAccount) return null
    const now = new Date()
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    const pad = (v: number) => String(v).padStart(2, '0')
    const cutoff = `${weekAgo.getFullYear()}-${pad(weekAgo.getMonth() + 1)}-${pad(weekAgo.getDate())} 00:00`
    return {
      totalLogins: drillLogs.length,
      weekLogins: drillLogs.filter((l) => l.time >= cutoff).length,
      lastLogin: drillAccount.lastLogin ?? drillLogs[0]?.time ?? '—',
      uploads: drillFiles.length,
    }
  }, [drillAccount, drillLogs, drillFiles])

  const openAdd = () => {
    setForm(emptyForm)
    setAddOpen(true)
  }

  const openEdit = (a: Account) => {
    setForm({
      username: a.username,
      name: a.name,
      role: a.role,
      center: a.center ?? '',
      sponsor: a.sponsor ?? '',
      email: a.email ?? '',
      phone: a.phone ?? '',
      password: a.password,
    })
    setEditTarget(a)
  }

  const submitAdd = () => {
    if (!form.username.trim() || !form.name.trim()) {
      toast.error('请填写登录账号与姓名')
      return
    }
    if (state.accounts.some((a) => a.username === form.username.trim())) {
      toast.error('登录账号已存在')
      return
    }
    const acc: Account = {
      id: nextId('acc'),
      username: form.username.trim(),
      name: form.name.trim(),
      title: form.role === 'pm' ? '项目经理' : form.role === 'executor' ? 'CRA' : 'ADMIN',
      role: form.role,
      center: form.role === 'executor' ? form.center.trim() || undefined : undefined,
      sponsor: form.sponsor || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      password: form.password || '123456',
      status: '激活',
      createdAt: todayStr(),
    }
    dispatch({ type: 'addAccount', account: acc })
    setAddOpen(false)
    toast.success(`已创建账号 ${acc.username}（${ROLE_LABEL[acc.role]}），状态默认为激活`)
  }

  const submitEdit = () => {
    if (!editTarget) return
    if (!form.name.trim()) {
      toast.error('请填写姓名')
      return
    }
    dispatch({
      type: 'updateAccount',
      id: editTarget.id,
      patch: {
        name: form.name.trim(),
        role: form.role,
        center: form.role === 'executor' ? form.center.trim() || undefined : undefined,
        sponsor: form.sponsor || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
      },
    })
    setEditTarget(null)
    toast.success('账号信息已更新')
  }

  /** admin 账号保护：不可冻结 / 关闭 / 删除 */
  const guardAdmin = (a: Account) => {
    if (a.username === 'admin') {
      toast.error('系统管理员账号不可执行此操作')
      return true
    }
    return false
  }

  const toggleFreeze = (a: Account) => {
    if (guardAdmin(a)) return
    const next: AccountStatus = a.status === '冻结' ? '激活' : '冻结'
    dispatch({ type: 'setAccountStatus', id: a.id, status: next })
    toast.success(next === '冻结' ? `已冻结账号 ${a.username}` : `已解冻账号 ${a.username}`)
  }

  const closeAccount = (a: Account) => {
    if (guardAdmin(a)) return
    if (!window.confirm(`确定关闭账号 ${a.username}（${a.name}）吗？关闭后该账号将无法登录。`)) return
    dispatch({ type: 'setAccountStatus', id: a.id, status: '关闭' })
    toast.success(`已关闭账号 ${a.username}`)
  }

  const removeAccount = (a: Account) => {
    if (guardAdmin(a)) return
    if (!window.confirm(`确定永久删除账号 ${a.username}（${a.name}）吗？此操作不可恢复。`)) return
    dispatch({ type: 'deleteAccount', id: a.id })
    toast.success(`已删除账号 ${a.username}`)
  }

  const resetPwd = (a: Account) => {
    if (!window.confirm(`确定将账号 ${a.username} 的密码重置为 123456 吗？`)) return
    dispatch({ type: 'updateAccount', id: a.id, patch: { password: '123456' } })
    toast.success(`账号 ${a.username} 的密码已重置为 123456`)
  }

  const formDialog = (
    open: boolean,
    onClose: () => void,
    title: string,
    onSubmit: () => void,
    isEdit: boolean,
  ) => (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <ModalHeader title={title} onClose={onClose} />
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="登录账号">
              <input
                className={cn(inputCls, isEdit && 'cursor-not-allowed bg-gray-100 text-gray-400')}
                value={form.username}
                disabled={isEdit}
                placeholder="如 wangwu"
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              />
            </Field>
            <Field label="姓名">
              <input
                className={inputCls}
                value={form.name}
                placeholder="如 王五"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field label="角色">
              <ToolbarSelect
                className="w-full"
                value={form.role}
                onChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}
                options={[
                  { label: '执行人员（CRA）', value: 'executor' },
                  { label: '管理人员（PM）', value: 'pm' },
                  { label: '系统管理员', value: 'admin' },
                ]}
              />
            </Field>
            <Field label="所属研究中心（执行人员）">
              <input
                className={cn(inputCls, form.role !== 'executor' && 'cursor-not-allowed bg-gray-100 text-gray-400')}
                value={form.center}
                disabled={form.role !== 'executor'}
                placeholder="如 上海瑞金医院"
                onChange={(e) => setForm((f) => ({ ...f, center: e.target.value }))}
              />
            </Field>
            <Field label="申办方（外部账号）">
              <ToolbarSelect
                className="w-full"
                value={form.sponsor}
                onChange={(v) => setForm((f) => ({ ...f, sponsor: v }))}
                options={[
                  { label: '无（内部员工）', value: '' },
                  ...state.customers.map((c) => ({ label: c.name, value: c.name })),
                ]}
              />
            </Field>
            <Field label="邮箱">
              <input
                className={inputCls}
                value={form.email}
                placeholder="name@clinx.cn"
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
            <Field label="联系方式">
              <input
                className={inputCls}
                value={form.phone}
                placeholder="如 138-0000-0000"
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </Field>
            {!isEdit && (
              <Field label="初始密码">
                <input
                  className={inputCls}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </Field>
            )}
          </div>
          <p className="text-xs text-gray-400">首次创建的账号状态默认为「激活」，创建后可在列表中冻结 / 关闭 / 删除。</p>
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

  const statCards = [
    { key: '全部' as const, label: '累计开通账户', value: stats.total, icon: Users, cls: 'bg-blue-50 text-blue-600', ring: statusFilter === '全部' },
    { key: '激活' as const, label: '使用中账户', value: stats.active, icon: UserCheck, cls: 'bg-teal-50 text-teal-600', ring: statusFilter === '激活' },
    { key: '冻结' as const, label: '冻结账户', value: stats.frozen, icon: Snowflake, cls: 'bg-amber-50 text-amber-600', ring: statusFilter === '冻结' },
    { key: '关闭' as const, label: '关闭 / 删除账号', value: stats.closedDeleted, icon: UserRoundX, cls: 'bg-gray-100 text-gray-500', ring: statusFilter === '关闭' },
  ]

  return (
    <PageCard
      title="账户配置"
      extra={
        <Button size="sm" className="h-9 gap-1.5 bg-teal-500 text-xs text-white hover:bg-teal-600" onClick={openAdd}>
          <Plus className="h-4 w-4" /> 新建账号
        </Button>
      }
    >
      {/* 账户分布统计（点击卡片联动筛选） */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {statCards.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStatusFilter(s.key)}
            className={cn(
              'flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-left transition-all hover:shadow-sm',
              s.cls,
              s.ring && 'border-current shadow-sm',
            )}
          >
            <s.icon className="h-7 w-7 opacity-70" />
            <span>
              <span className="block text-xl font-bold leading-6">{s.value}</span>
              <span className="text-[11px] opacity-70">{s.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* 工具栏 */}
      <div className="mb-4 flex items-center gap-3">
        <SearchInput value={kw} onChange={setKw} placeholder="搜索账号 / 姓名 / 中心" className="w-64" />
        <ToolbarSelect
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { label: '全部角色', value: '全部' },
            { label: '管理人员', value: 'pm' },
            { label: '执行人员', value: 'executor' },
            { label: '系统管理员', value: 'admin' },
          ]}
        />
        <ToolbarSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as '全部' | AccountStatus)}
          options={[
            { label: '全部状态', value: '全部' },
            { label: '激活', value: '激活' },
            { label: '冻结', value: '冻结' },
            { label: '关闭', value: '关闭' },
          ]}
        />
      </div>

      <DataTable>
        <thead>
          <tr>
            <Th sortable={false} className="w-32">登录账号</Th>
            <Th sortable={false} className="w-24">姓名</Th>
            <Th sortable={false} className="w-20">角色</Th>
            <Th sortable={false} className="w-28">申办方</Th>
            <Th sortable={false}>邮箱</Th>
            <Th sortable={false} className="w-32">联系方式</Th>
            <Th sortable={false} className="w-32">创建日期</Th>
            <Th sortable={false} className="w-24">账号状态</Th>
            <Th sortable={false} className="w-48">操作</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <Tr key={a.id} onClick={() => setDrillAccount(a)} className="hover:bg-teal-50/40">
              <Td className="font-mono text-xs">{a.username}</Td>
              <Td>{a.name}</Td>
              <Td>
                <span className={cn('rounded-full px-2.5 py-1 text-xs', ROLE_BADGE[a.role])}>
                  {ROLE_LABEL[a.role]}
                </span>
              </Td>
              <Td className="text-xs">{a.sponsor ?? '—'}</Td>
              <Td className="text-xs">{a.email ?? '—'}</Td>
              <Td className="font-mono text-xs">{a.phone ?? '—'}</Td>
              <Td className="text-xs">{a.createdAt}</Td>
              <Td>
                <span className={cn('rounded-full px-2.5 py-1 text-xs', STATUS_BADGE[a.status])}>{a.status}</span>
              </Td>
              <Td>
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    title="查看详情"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDrillAccount(a)
                    }}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="编辑"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEdit(a)
                    }}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-teal-50 hover:text-teal-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="重置密码"
                    onClick={(e) => {
                      e.stopPropagation()
                      resetPwd(a)
                    }}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={a.status === '冻结' ? '解冻' : '冻结'}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFreeze(a)
                    }}
                    className={cn(
                      'rounded-lg p-1.5 transition-colors',
                      a.status === '冻结'
                        ? 'text-amber-500 hover:bg-teal-50 hover:text-teal-600'
                        : 'text-gray-400 hover:bg-amber-50 hover:text-amber-600',
                    )}
                  >
                    {a.status === '冻结' ? <CheckCircle2 className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    title="关闭账号"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeAccount(a)
                    }}
                    className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="删除账号"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAccount(a)
                    }}
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
              <Td className="py-10 text-gray-400">未找到匹配账号</Td>
              <Td />
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

      {formDialog(addOpen, () => setAddOpen(false), '新建账号', submitAdd, false)}
      {formDialog(!!editTarget, () => setEditTarget(null), '编辑账号', submitEdit, true)}

      {/* 账号下钻：登录流水 + 上传足迹 */}
      <Dialog open={!!drillAccount} onOpenChange={(o) => !o && setDrillAccount(null)}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-4xl">
          <DialogTitle className="sr-only">账号详情</DialogTitle>
          <ModalHeader
            title={drillAccount ? `${drillAccount.name}（${drillAccount.username}）· 账号详情` : '账号详情'}
            onClose={() => setDrillAccount(null)}
          />
          {drillAccount && drillStats && (
            <div className="max-h-[calc(85vh-52px)] overflow-y-auto p-5">
              {/* 账号信息条 */}
              <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-gray-50 px-4 py-3 text-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-bold text-white">
                  {drillAccount.name.slice(0, 1)}
                </span>
                <span className={cn('rounded-full px-2.5 py-1 text-xs', ROLE_BADGE[drillAccount.role])}>
                  {ROLE_LABEL[drillAccount.role]}
                </span>
                <span className="text-gray-500">
                  所属中心：<span className="text-gray-700">{drillAccount.center ?? '—'}</span>
                </span>
                <span className="text-gray-500">
                  申办方：<span className="text-gray-700">{drillAccount.sponsor ?? '—'}</span>
                </span>
                <span className="text-gray-500">
                  邮箱：<span className="text-gray-700">{drillAccount.email ?? '—'}</span>
                </span>
                <span className="text-gray-500">
                  联系方式：<span className="font-mono text-xs text-gray-700">{drillAccount.phone ?? '—'}</span>
                </span>
                <span className="text-gray-500">
                  创建日期：<span className="text-gray-700">{drillAccount.createdAt}</span>
                </span>
                <span className={cn('rounded-full px-2.5 py-1 text-xs', STATUS_BADGE[drillAccount.status])}>
                  {drillAccount.status}
                </span>
              </div>

              {/* 汇总卡 */}
              <div className="mb-5 grid grid-cols-4 gap-3">
                {[
                  { label: '累计登录', value: drillStats.totalLogins, cls: 'bg-blue-50 text-blue-600' },
                  { label: '近 7 天登录', value: drillStats.weekLogins, cls: 'bg-teal-50 text-teal-600' },
                  { label: '上传文件', value: drillStats.uploads, cls: 'bg-violet-50 text-violet-600' },
                  { label: '最近登录', value: drillStats.lastLogin, cls: 'bg-gray-50 text-gray-700', small: true },
                ].map((s) => (
                  <div key={s.label} className={cn('rounded-xl px-4 py-3 text-center', s.cls)}>
                    <div className={cn('font-bold', s.small ? 'mt-0.5 text-sm' : 'text-lg')}>{s.value}</div>
                    <div className="text-[11px] opacity-70">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* 登录流水 */}
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <LogIn className="h-4 w-4 text-teal-500" /> 登录流水
                <span className="text-xs font-normal text-gray-400">（最近 10 条）</span>
              </div>
              <div className="mb-5 overflow-x-auto">
                <DataTable>
                  <thead>
                    <tr>
                      <Th sortable={false}>登录时间</Th>
                      <Th sortable={false} className="w-40">登录账号</Th>
                      <Th sortable={false} className="w-24">角色</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillLogs.slice(0, 10).map((l) => (
                      <Tr key={l.id}>
                        <Td className="font-mono text-xs">{l.time}</Td>
                        <Td className="font-mono text-xs">{l.username}</Td>
                        <Td>
                          <span className={cn('rounded-full px-2.5 py-1 text-xs', ROLE_BADGE[l.role])}>
                            {ROLE_LABEL[l.role]}
                          </span>
                        </Td>
                      </Tr>
                    ))}
                    {drillLogs.length === 0 && (
                      <Tr>
                        <Td className="py-8 text-gray-400">暂无登录记录</Td>
                        <Td />
                        <Td />
                      </Tr>
                    )}
                  </tbody>
                </DataTable>
              </div>

              {/* 上传足迹 */}
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <UploadCloud className="h-4 w-4 text-teal-500" /> 上传足迹
                <span className="text-xs font-normal text-gray-400">（最近 10 条，按上传日期倒序）</span>
              </div>
              <div className="overflow-x-auto">
                <DataTable>
                  <thead>
                    <tr>
                      <NameTh>文件名称</NameTh>
                      <Th sortable={false} className="w-36">项目编号</Th>
                      <Th sortable={false} className="w-36">研究中心</Th>
                      <Th sortable={false} className="w-32">上传日期</Th>
                      <Th sortable={false} className="w-24">状态</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillFiles.slice(0, 10).map((f) => (
                      <Tr key={f.id}>
                        <Td>
                          <span className="inline-flex items-center gap-2">
                            <FileTypeIcon kind={f.kind} />
                            <span className="text-gray-700">{f.name}</span>
                          </span>
                        </Td>
                        <Td>
                          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] text-teal-600">
                            {f.projectNo}
                          </span>
                        </Td>
                        <Td>{f.center}</Td>
                        <Td className="text-xs">{f.uploadDate}</Td>
                        <Td>
                          <span className={cn('rounded-full px-2.5 py-1 text-xs', FILE_STATUS_BADGE[f.status])}>
                            {FILE_STATUS_LABEL[f.status]}
                          </span>
                        </Td>
                      </Tr>
                    ))}
                    {drillFiles.length === 0 && (
                      <Tr>
                        <Td className="py-8 text-gray-400">暂无上传记录</Td>
                        <Td />
                        <Td />
                        <Td />
                        <Td />
                      </Tr>
                    )}
                  </tbody>
                </DataTable>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageCard>
  )
}
