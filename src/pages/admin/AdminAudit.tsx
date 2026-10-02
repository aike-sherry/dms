import { useMemo, useState } from 'react'
import { History } from 'lucide-react'
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
  )
}
