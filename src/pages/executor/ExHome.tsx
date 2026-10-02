import { useMemo } from 'react'
import { PageCard, DataTable, Th, Td, Tr } from '@/components/common'
import { StudyDonutCard, SiteStatCards, SummaryBarCard } from '@/pages/Home'
import { useStore, statsByCenter, craNameOf, EXECUTOR_NAME } from '@/store'

/* 执行人员首页：与 PM 首页结构相同，统计作用域仅自己的文件；底部为单表（无 STUDY/SITE 双 Tab） */
export default function ExHome() {
  const { state } = useStore()
  const myFiles = useMemo(() => state.files.filter((f) => f.uploader === EXECUTOR_NAME), [state.files])
  const siteRows = useMemo(() => statsByCenter(myFiles), [myFiles])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 items-start gap-5">
        <StudyDonutCard files={myFiles} />
        <SiteStatCards files={myFiles} />
      </div>
      <SummaryBarCard files={myFiles} />
      <PageCard bodyClassName="pt-1" className="pt-4">
        <DataTable className="mt-2">
          <thead>
            <tr>
              <Th sortable={false}>研究中心</Th>
              <Th sortable={false}>临床监查员</Th>
              <Th sortable={false}>上传</Th>
              <Th sortable={false}>待审批</Th>
              <Th sortable={false}>驳回</Th>
              <Th sortable={false}>归档</Th>
            </tr>
          </thead>
          <tbody>
            {siteRows.map((r) => {
              /* R32：CRA 列改读研究中心注册表；未配置显示 — */
              const cra = craNameOf(state.centers, r.center)
              return (
              <Tr key={r.center}>
                <Td>{r.center}</Td>
                <Td>
                  {cra ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-[11px] font-medium text-teal-600">
                        {cra.slice(0, 1)}
                      </span>
                      {cra}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </Td>
                <Td>{r.uploaded}</Td>
                <Td>{r.pending}</Td>
                <Td>{r.rejected}</Td>
                <Td>{r.archived}</Td>
              </Tr>
              )
            })}
            {siteRows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-gray-400">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </PageCard>
    </div>
  )
}
