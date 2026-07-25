import { useMemo, useState } from 'react'
import { Users, UserCheck, Building2, LogIn, ChevronRight } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ModalHeader } from '@/components/CatalogDialog'
import { PageCard, DataTable, Th, Td, Tr, FileTypeIcon } from '@/components/common'
import { useStore, type FileStatus, type Role } from '@/store'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<Role, string> = { pm: '管理人员', executor: '执行人员', admin: '系统管理员' }
const ROLE_COLOR: Record<Role, string> = { pm: '#14b8a6', executor: '#f97316', admin: '#8b5cf6' }
const ROLE_BADGE: Record<Role, string> = {
  pm: 'bg-teal-50 text-teal-600',
  executor: 'bg-orange-50 text-orange-600',
  admin: 'bg-violet-50 text-violet-600',
}

/** 文件状态展示（健康度下钻明细） */
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

export default function AdminDashboard() {
  const { state } = useStore()
  const { accounts, customers, loginLogs } = state
  const [drillProject, setDrillProject] = useState<string | null>(null)

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  /* 近 14 天按天 × 角色聚合 */
  const trend = useMemo(() => {
    const days: { date: string; label: string; pm: number; executor: number; admin: number }[] = []
    for (let d = 13; d >= 0; d--) {
      const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - d)
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
      days.push({ date: key, label: key.slice(5), pm: 0, executor: 0, admin: 0 })
    }
    const idx = new Map(days.map((d, i) => [d.date, i]))
    for (const log of loginLogs) {
      const i = idx.get(log.time.slice(0, 10))
      if (i !== undefined) days[i][log.role] += 1
    }
    return days
  }, [loginLogs])

  /* 近 14 天按角色聚合（饼图） */
  const roleShare = useMemo(() => {
    const sum: Record<Role, number> = { pm: 0, executor: 0, admin: 0 }
    for (const d of trend) {
      sum.pm += d.pm
      sum.executor += d.executor
      sum.admin += d.admin
    }
    return (Object.keys(sum) as Role[])
      .map((r) => ({ name: ROLE_LABEL[r], value: sum[r], color: ROLE_COLOR[r] }))
      .filter((s) => s.value > 0)
  }, [trend])

  const todayCount = loginLogs.filter((l) => l.time.startsWith(todayKey)).length
  const activeAccounts = accounts.filter((a) => a.status === '激活').length
  const activeCustomers = customers.filter((c) => c.status === '合作中').length
  const recent = loginLogs.slice(0, 8)

  /* 项目文件健康度：按项目前缀（ON101/ON102/ON103）聚合归档率 / 驳回率，按归档率降序 */
  const health = useMemo(() => {
    const groups = new Map<string, { total: number; archived: number; rejected: number; pending: number }>()
    for (const f of state.files) {
      if (f.parentId) continue /* 文件夹子文件不重复计数 */
      const m = /^ON\d+/.exec(f.projectNo)
      const key = m ? m[0] : f.projectNo
      const g = groups.get(key) ?? { total: 0, archived: 0, rejected: 0, pending: 0 }
      g.total += 1
      if (f.status === 'archived') g.archived += 1
      if (f.status === 'rejected') g.rejected += 1
      if (f.status === 'pending') g.pending += 1
      groups.set(key, g)
    }
    return [...groups.entries()]
      .map(([project, g]) => ({
        project,
        ...g,
        archiveRate: g.total ? Math.round((g.archived / g.total) * 100) : 0,
        rejectRate: g.total ? Math.round((g.rejected / g.total) * 100) : 0,
      }))
      .sort((a, b) => b.archiveRate - a.archiveRate)
  }, [state.files])

  /* 健康度卡片下钻：当前选中项目的文件明细（含子文件，按日期倒序） */
  const drillFiles = useMemo(() => {
    if (!drillProject) return []
    return state.files
      .filter((f) => f.projectNo.startsWith(drillProject))
      .sort((a, b) => b.uploadDate.localeCompare(a.uploadDate))
  }, [state.files, drillProject])

  const drillHealth = health.find((h) => h.project === drillProject)

  const cards = [
    { icon: Users, label: '账户总数', value: accounts.length, tint: 'bg-teal-50 text-teal-600' },
    { icon: UserCheck, label: '启用账户', value: activeAccounts, tint: 'bg-blue-50 text-blue-600' },
    { icon: Building2, label: '合作客户', value: activeCustomers, tint: 'bg-violet-50 text-violet-600' },
    { icon: LogIn, label: '今日登录', value: todayCount, tint: 'bg-orange-50 text-orange-600' },
  ]

  return (
    <div className="space-y-5">
      {/* 统计卡 */}
      <div className="grid grid-cols-4 gap-5">
        {cards.map(({ icon: Icon, label, value, tint }) => (
          <PageCard key={label} className="!p-5">
            <div className="flex items-center gap-4">
              <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', tint)}>
                <Icon className="h-6 w-6" strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{value}</div>
                <div className="text-xs text-gray-400">{label}</div>
              </div>
            </div>
          </PageCard>
        ))}
      </div>

      {/* 登录趋势 */}
      <div className="grid grid-cols-[1.8fr_1fr] gap-5">
        <PageCard title="用户登录趋势（近 14 天）">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(20,184,166,0.06)' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="pm" name="管理人员" stackId="a" fill={ROLE_COLOR.pm} radius={[0, 0, 0, 0]} />
                <Bar dataKey="executor" name="执行人员" stackId="a" fill={ROLE_COLOR.executor} />
                <Bar dataKey="admin" name="系统管理员" stackId="a" fill={ROLE_COLOR.admin} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PageCard>

        <PageCard title="登录角色分布（近 14 天）">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={roleShare}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={3}
                  cornerRadius={6}
                >
                  {roleShare.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </PageCard>
      </div>

      {/* 项目文件健康度：各项目归档率 / 驳回率排行 */}
      <PageCard
        title="项目文件健康度"
        extra={
          <span className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-teal-500" /> 归档率
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-400" /> 驳回率
            </span>
          </span>
        }
      >
        <div className="grid grid-cols-3 gap-4">
          {health.map((h, i) => (
            <div
              key={h.project}
              role="button"
              tabIndex={0}
              onClick={() => setDrillProject(h.project)}
              onKeyDown={(e) => e.key === 'Enter' && setDrillProject(h.project)}
              title="点击查看项目文件明细"
              className="group cursor-pointer rounded-xl border border-gray-100 bg-gray-50/40 p-4 transition-all hover:border-teal-200 hover:shadow-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                      i === 0
                        ? 'bg-teal-500 text-white'
                        : i === 1
                          ? 'bg-teal-100 text-teal-600'
                          : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="font-semibold text-gray-800">{h.project}</span>
                  <ChevronRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-teal-500" />
                </div>
                <span className="text-xs text-gray-400">共 {h.total} 个文件</span>
              </div>

              {/* 归档率 */}
              <div className="mb-2.5">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-gray-500">归档率</span>
                  <span className="font-semibold text-teal-600">{h.archiveRate}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all"
                    style={{ width: `${h.archiveRate}%` }}
                  />
                </div>
              </div>

              {/* 驳回率 */}
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-gray-500">驳回率</span>
                  <span className={cn('font-semibold', h.rejectRate > 0 ? 'text-rose-500' : 'text-gray-400')}>
                    {h.rejectRate}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-rose-400 transition-all"
                    style={{ width: `${h.rejectRate}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-gray-100 pt-2.5 text-[11px] text-gray-400">
                <span>归档 {h.archived}</span>
                <span>审核中 {h.pending}</span>
                <span>驳回 {h.rejected}</span>
              </div>
            </div>
          ))}
        </div>
      </PageCard>

      {/* 最近登录记录 */}
      <PageCard title="最近登录记录">
        <DataTable>
          <thead>
            <tr>
              <Th sortable={false}>登录时间</Th>
              <Th sortable={false}>登录账号</Th>
              <Th sortable={false}>姓名</Th>
              <Th sortable={false}>角色</Th>
            </tr>
          </thead>
          <tbody>
            {recent.map((l) => (
              <Tr key={l.id}>
                <Td className="font-mono text-xs">{l.time}</Td>
                <Td className="font-mono text-xs">{l.username || '—'}</Td>
                <Td>{l.name || '—'}</Td>
                <Td>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs', ROLE_BADGE[l.role])}>
                    {ROLE_LABEL[l.role]}
                  </span>
                </Td>
              </Tr>
            ))}
            {recent.length === 0 && (
              <Tr>
                <Td className="py-10 text-gray-400">暂无登录记录</Td>
                <Td />
                <Td />
                <Td />
              </Tr>
            )}
          </tbody>
        </DataTable>
      </PageCard>

      {/* 健康度下钻：项目文件明细弹窗 */}
      <Dialog open={!!drillProject} onOpenChange={(o) => !o && setDrillProject(null)}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-6xl"
        >
          <DialogTitle className="sr-only">项目文件明细</DialogTitle>
          <ModalHeader
            title={drillProject ? `${drillProject} · 项目文件明细` : '项目文件明细'}
            onClose={() => setDrillProject(null)}
          />
          <div className="max-h-[calc(85vh-52px)] overflow-y-auto p-5">
            {/* 状态汇总 */}
            {drillHealth && (
              <div className="mb-4 grid grid-cols-5 gap-3">
                {[
                  { label: '文件总数', value: drillHealth.total, cls: 'bg-gray-50 text-gray-700' },
                  { label: '归档', value: drillHealth.archived, cls: 'bg-teal-50 text-teal-600' },
                  { label: '审核中', value: drillHealth.pending, cls: 'bg-amber-50 text-amber-600' },
                  { label: '驳回', value: drillHealth.rejected, cls: 'bg-rose-50 text-rose-500' },
                  { label: '归档率', value: `${drillHealth.archiveRate}%`, cls: 'bg-blue-50 text-blue-600' },
                ].map((s) => (
                  <div key={s.label} className={cn('rounded-xl px-4 py-3 text-center', s.cls)}>
                    <div className="text-lg font-bold">{s.value}</div>
                    <div className="text-[11px] opacity-70">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 文件明细表 */}
            {/* 文件明细表（列多可横向滚动） */}
            <div className="overflow-x-auto">
              <DataTable>
                <thead>
                  <tr>
                    <Th sortable={false}>文件名称</Th>
                    <Th sortable={false}>项目编号</Th>
                    <Th sortable={false}>研究中心</Th>
                    <Th sortable={false}>上传人员</Th>
                    <Th sortable={false}>上传日期</Th>
                    <Th sortable={false}>文件大小</Th>
                    <Th sortable={false}>状态</Th>
                  </tr>
                </thead>
              <tbody>
                {drillFiles.map((f) => (
                  <Tr key={f.id} className={cn(f.parentId && 'bg-gray-50/50')}>
                    <Td className="text-left">
                      <span className="inline-flex items-center gap-2 pl-4">
                        <FileTypeIcon kind={f.kind} />
                        <span className="text-gray-700">
                          {f.parentId && <span className="mr-1 text-gray-300">└</span>}
                          {f.name}
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] text-teal-600">
                        {f.projectNo}
                      </span>
                    </Td>
                    <Td>{f.center}</Td>
                    <Td>{f.uploader}</Td>
                    <Td className="text-xs">{f.uploadDate}</Td>
                    <Td className="text-xs">{f.size}</Td>
                    <Td>
                      <span className={cn('rounded-full px-2.5 py-1 text-xs', FILE_STATUS_BADGE[f.status])}>
                        {FILE_STATUS_LABEL[f.status]}
                      </span>
                    </Td>
                  </Tr>
                ))}
                {drillFiles.length === 0 && (
                  <Tr>
                    <Td className="py-10 text-gray-400">该项目暂无文件</Td>
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
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
