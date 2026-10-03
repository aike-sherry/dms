import { useMemo, useState } from 'react'
import { History, Link2, Unlink } from 'lucide-react'
import { PageCard, DataTable, Th, Td, Tr, ToolbarSelect } from '@/components/common'
import { cn } from '@/lib/utils'
import { useStore, type NamingLog, type Role } from '@/store'

/** 动作徽标配色：创建命名 teal / 修改文件名 amber / 重名追加 cyan */
const ACTION_CLS: Record<NamingLog['action'], string> = {
  创建命名: 'bg-teal-50 text-teal-600 ring-1 ring-teal-100',
  修改文件名: 'bg-amber-50 text-amber-600 ring-1 ring-amber-100',
  重名追加: 'bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100',
}
const ROLE_LABEL: Record<Role, string> = { pm: 'PM', executor: 'CRA', admin: 'ADMIN' }

/* C3 观察期：骨架命名覆盖统计卡——直接读 state.files 落库字段推导，不新设存储。
   口径（与 HOME 统计一致：只统计具体文件，kind='folder' 的文件夹不计入）：
   - 骨架命名（新流程）= 文件落库带 namingTemplateId（CRA 命名向导 / PM 归档确认制均写入该字段）；
     注意同一字段在 kind='folder' 条目上表示"文件夹绑定骨架"，故必须先排除文件夹，语义才纯净
   - 未绑定（旧通道）= 其余具体文件（未关联骨架的上传）
   - 占比 = 未绑定 / 全部具体文件；total=0 除零保护显示「暂无数据」 */
function NamingCoverageCard() {
  const { state } = useStore()
  const stats = useMemo(() => {
    const docs = state.files.filter((f) => f.kind !== 'folder')
    const bound = docs.filter((f) => !!f.namingTemplateId).length
    const total = docs.length
    const unbound = total - bound
    /* 百分比互补取值，保证两卡之和恒为 100；total=0 时不计算（除零保护） */
    const boundPct = total > 0 ? Math.round((bound / total) * 100) : 0
    return { total, bound, unbound, boundPct, unboundPct: 100 - boundPct }
  }, [state.files])

  const cards = [
    {
      key: 'bound',
      label: '骨架命名 · 绑定目录新流程',
      value: stats.bound,
      pct: stats.boundPct,
      pctLabel: `占上传 ${stats.boundPct}%`,
      pctCls: 'text-gray-400',
      color: '#14b8a6',
      Icon: Link2,
    },
    {
      key: 'unbound',
      label: '未绑定 · 旧通道上传',
      value: stats.unbound,
      pct: stats.unboundPct,
      pctLabel: `未绑定占比 ${stats.unboundPct}%`,
      pctCls: 'font-medium text-amber-500',
      color: '#f59e0b',
      Icon: Unlink,
    },
  ]

  return (
    <PageCard
      title="上传命名覆盖观察"
      extra={<span className="text-xs text-gray-400">口径：全部已上传文件（不含文件夹），按落库骨架 ID 分流</span>}
    >
      {stats.total === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          <History className="mx-auto mb-2 h-5 w-5 text-gray-300" />
          暂无数据<span className="ml-1 text-xs text-gray-300">（有文件上传后自动统计）</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {cards.map((c) => (
            <div key={c.key} className="flex flex-col rounded-xl p-4 ring-1 ring-gray-100/60" style={{ backgroundColor: `${c.color}0d` }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-gray-400">{c.label}</div>
                  <div className="mt-1.5 text-[32px] leading-none font-semibold text-gray-800">
                    {c.value}
                    <span className="ml-1 text-xs font-normal text-gray-400">个</span>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-sm" style={{ backgroundColor: c.color }}>
                  <c.Icon className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="mt-3.5">
                <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.max(c.pct, c.value > 0 ? 6 : 0)}%`, backgroundColor: c.color }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className={c.pctCls}>{c.pctLabel}</span>
                  <span className="text-gray-300">共 {stats.total} 个</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageCard>
  )
}

/* R39 二阶段A：admin 全局命名审计——创建命名 / 修改文件名 / 重名追加全量流水，
   按项目/操作人筛选，时间倒序；日志只增不改（audit trail） */
export default function AdminAudit() {
  const { state } = useStore()
  const [proj, setProj] = useState('全部')
  const [oper, setOper] = useState('全部')

  const projects = useMemo(
    () => [...new Set(state.namingLogs.map((l) => l.projectNo).filter((p): p is string => !!p))].sort(),
    [state.namingLogs],
  )
  const operators = useMemo(
    () => [...new Set(state.namingLogs.map((l) => l.operator))].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
    [state.namingLogs],
  )
  /* 时间倒序（time 为 YYYY-MM-DD HH:mm，字符串可比较）；同刻保持落库顺序（新日志在前） */
  const rows = useMemo(
    () =>
      [...state.namingLogs]
        .sort((a, b) => b.time.localeCompare(a.time))
        .filter((l) => (proj === '全部' || l.projectNo === proj) && (oper === '全部' || l.operator === oper)),
    [state.namingLogs, proj, oper],
  )

  return (
    <div className="space-y-5">
      <NamingCoverageCard />
      <PageCard
        title="命名审计日志"
        extra={
        <div className="flex items-center gap-2">
          <ToolbarSelect value={proj} onChange={setProj} options={['全部', ...projects]} className="w-40 [&>select]:w-full" />
          <ToolbarSelect value={oper} onChange={setOper} options={['全部', ...operators]} className="w-36 [&>select]:w-full" />
          <span className="text-xs whitespace-nowrap text-gray-400">共 {rows.length} 条</span>
        </div>
      }
    >
      <DataTable>
        <thead>
          <tr>
            <Th className="w-40">时间</Th>
            <Th className="w-28">项目</Th>
            <Th className="w-32">操作人</Th>
            <Th className="w-24">动作</Th>
            <Th className="w-44">原文件名</Th>
            <Th sortable={false}>旧显示名 → 新显示名</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <Tr key={l.id}>
              <Td className="font-mono text-xs text-gray-500">{l.time}</Td>
              <Td className="text-xs text-gray-600">{l.projectNo ?? '—'}</Td>
              <Td>
                <span className="inline-flex items-center justify-center gap-1.5 text-xs text-gray-700">
                  {l.operator}
                  {l.role && (
                    <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400 ring-1 ring-gray-200">
                      {ROLE_LABEL[l.role]}
                    </span>
                  )}
                </span>
              </Td>
              <Td>
                <span className={cn('rounded-full px-2 py-0.5 text-xs whitespace-nowrap', ACTION_CLS[l.action])}>{l.action}</span>
              </Td>
              <Td className="text-xs text-gray-500">
                <span className="mx-auto block max-w-44 truncate" title={l.originalFilename ?? ''}>{l.originalFilename ?? '—'}</span>
              </Td>
              <Td>
                <span className="inline-flex max-w-full items-center justify-center gap-1.5 text-xs">
                  {l.oldValue ? (
                    <span className="max-w-52 truncate text-gray-400 line-through" title={l.oldValue}>
                      {l.oldValue}
                    </span>
                  ) : (
                    <span className="text-gray-300">（新建）</span>
                  )}
                  <span className="text-gray-300">→</span>
                  <span className="max-w-52 truncate font-medium text-teal-600" title={l.newValue}>
                    {l.newValue}
                  </span>
                </span>
              </Td>
            </Tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                <History className="mx-auto mb-2 h-5 w-5 text-gray-300" />
                暂无命名审计日志{proj !== '全部' || oper !== '全部' ? '（可放宽筛选条件）' : '（CRA 经命名向导上传或 PM 修改显示名后自动记录）'}
              </td>
            </tr>
          )}
        </tbody>
      </DataTable>
    </PageCard>
    </div>
  )
}
