import { useMemo, useState } from 'react'
import { Download, FolderOpen, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageCard, DataTable, Th, Td, NameTd, NameTh, Tr, FileTypeIcon, TealLink } from '@/components/common'
import { OverviewTable } from '@/pages/Submission'
import { submissionFolderFiles } from '@/data/mock'
import { EXECUTOR_CENTER, EX_USER, useStore, type Center, type Submission } from '@/store'

/* 执行人员 SUBMISSION（R35 重写数据链路）：
   - 可见范围 = 本人负责的中心所涉项目（分配来源 = 首页「研究中心管理」注册表 cra 字段；兼容账号中心名旧匹配）；
     递交文件列表与递交概况矩阵行均按此过滤，PM 发布后经跨标签页同步即时可见
   - 递交概况矩阵：本人负责的中心列「待递交」单元格可点击弹出日历录入递交日期，选定即保存；
     其他中心列只读；PM 端矩阵同步只读显示 */
export default function ExSubmission() {
  const { state, dispatch } = useStore()
  /* 本人负责的中心：注册表 cra=当前执行人员姓名 ∪ 账号中心名旧匹配（互相包含兜底），按中心名去重 */
  const myCenters = useMemo(() => {
    const map = new Map<string, Center>()
    for (const c of state.centers) {
      if (c.cra === EX_USER.name || EXECUTOR_CENTER.includes(c.name) || c.name.includes(EXECUTOR_CENTER)) {
        if (!map.has(c.name)) map.set(c.name, c)
      }
    }
    return [...map.values()]
  }, [state.centers])
  const myHospitals = useMemo(() => myCenters.map((c) => c.name), [myCenters])
  /* 本人负责中心所涉项目（注册表项目编号） */
  const myProjects = useMemo(() => [...new Set(myCenters.map((c) => c.projectNo))], [myCenters])
  const projMatch = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a)
  /* 递交文件列表：已发布 + 本人项目 + 静默跟随全局项目筛选 */
  const project = state.activeProject
  const published = state.submissions.filter(
    (s) =>
      s.published &&
      myProjects.some((p) => projMatch(s.projectNo, p)) &&
      (project === '全部' || s.projectNo.startsWith(project)),
  )
  /* 递交概况矩阵行：按本人项目过滤（行 id = 递交 id，联查递交的项目编号；查不到的行保留防误隐藏） */
  const myRows = useMemo(() => {
    const projOf = new Map(state.submissions.map((s) => [s.id, s.projectNo]))
    return state.submissionSchedule.filter((r) => {
      const p = projOf.get(r.id)
      return !p || myProjects.some((mp) => projMatch(p, mp))
    })
  }, [state.submissionSchedule, state.submissions, myProjects])
  const [folderView, setFolderView] = useState<Submission | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [folderSel, setFolderSel] = useState<Set<string>>(new Set())

  const toggleIn = (set: Set<string>, key: string, checked: boolean) => {
    const next = new Set(set)
    if (checked) next.add(key)
    else next.delete(key)
    return next
  }

  /* R35：单元格选定日期即保存（单格更新），PM 端矩阵同步只读显示 */
  const saveCell = (rowId: string, hospital: string, date: string) => {
    dispatch({ type: 'saveSubmissionDates', updates: [{ rowId, hospital, date }] })
    const topic = state.submissionSchedule.find((r) => r.id === rowId)?.topic ?? ''
    toast.success('递交日期已更新', { description: `${hospital} · ${topic}：${date}` })
  }

  const downloadFiles = (files: { name?: string; fileName?: string }[]) => {
    if (files.length === 0) {
      toast.info('暂无可下载的文件')
      return
    }
    const label = (f: { name?: string; fileName?: string }) => f.name ?? f.fileName ?? ''
    const names = files.slice(0, 3).map(label).join('、')
    toast.success(`已开始下载 ${files.length} 个文件`, {
      description: names + (files.length > 3 ? ` 等 ${files.length} 个文件` : ''),
    })
  }

  return (
    <div className="space-y-5">
      <PageCard title="递交概况">
        <OverviewTable rows={myRows} editableHospitals={myHospitals} onSaveDate={saveCell} />
        {myHospitals.length > 0 ? (
          <p className="mt-3 text-xs text-gray-400">
            仅本人负责的中心（{myHospitals.join('、')}）可点击「待递交」单元格录入递交日期，选定即保存；其他中心只读。
          </p>
        ) : (
          <p className="mt-3 text-xs text-gray-400">
            注册表中暂无本人负责的中心（{EXECUTOR_CENTER}），暂无可录入列；请联系 PM 在首页「研究中心管理」中配置。
          </p>
        )}
      </PageCard>

      <PageCard
        title="递交文件"
        extra={
          <div className="flex items-center gap-2">
            {sel.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs text-gray-400 hover:text-gray-600"
                onClick={() => setSel(new Set())}
              >
                <X className="h-3.5 w-3.5" /> 取消选择
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 border-teal-200 text-xs text-teal-600 hover:bg-teal-50 hover:text-teal-700"
              onClick={() => {
                downloadFiles(sel.size ? published.filter((s) => sel.has(s.id)) : published)
                setSel(new Set())
              }}
            >
              <Download className="h-3.5 w-3.5" /> 下载{sel.size ? ` 所选（${sel.size}）` : ' 全部'}
            </Button>
          </div>
        }
      >
        <DataTable>
          <thead>
            <tr>
              <Th sortable={false} className="w-10">
                <input
                  type="checkbox"
                  aria-label="全选"
                  className="h-4 w-4 cursor-pointer accent-teal-600"
                  ref={(el) => {
                    if (el) el.indeterminate = sel.size > 0 && sel.size < published.length
                  }}
                  checked={published.length > 0 && sel.size === published.length}
                  onChange={(e) => setSel(e.target.checked ? new Set(published.map((s) => s.id)) : new Set())}
                />
              </Th>
              <Th sortable={false} className="w-52">递交主题</Th>
              <NameTh className="w-[22%]">文件</NameTh>
              <Th className="w-36">项目编号</Th>
              <Th className="w-36">上传日期</Th>
              <Th className="w-28">文件大小</Th>
              <Th sortable={false} className="w-24">操作</Th>
            </tr>
          </thead>
          <tbody>
            {published.map((s) => (
              <Tr key={s.id}>
                <Td className="w-10">
                  <input
                    type="checkbox"
                    aria-label={`选择 ${s.fileName}`}
                    className="h-4 w-4 cursor-pointer accent-teal-600"
                    checked={sel.has(s.id)}
                    onChange={(e) => setSel((prev) => toggleIn(prev, s.id, e.target.checked))}
                  />
                </Td>
                <Td>{s.topic}</Td>
                <NameTd>
                  <span className="flex items-center gap-2.5">
                    <FileTypeIcon kind={s.kind} />
                    {s.kind === 'folder' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFolderView(s)
                          setFolderSel(new Set())
                        }}
                        title="点击打开文件夹"
                        className="text-gray-700 underline decoration-teal-300 decoration-dotted underline-offset-4 transition-colors hover:text-teal-600"
                      >
                        {s.fileName}
                      </button>
                    ) : (
                      <span className="text-gray-700">{s.fileName}</span>
                    )}
                  </span>
                </NameTd>
                <Td>{s.projectNo}</Td>
                <Td>{s.uploadDate}</Td>
                <Td>{s.size}</Td>
                <Td>
                  <TealLink onClick={() => downloadFiles([s])}>下载</TealLink>
                </Td>
              </Tr>
            ))}
            {published.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-gray-400">
                  {myCenters.length === 0
                    ? '注册表中暂无本人负责的中心，递交文件按分配项目过滤后为空'
                    : '暂无已发布的递交文件'}
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </PageCard>

      {/* 文件夹内容查看/下载弹窗 */}
      <Dialog open={!!folderView} onOpenChange={(o) => !o && setFolderView(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-5 w-5 text-amber-500" />
              {folderView?.fileName}
            </DialogTitle>
          </DialogHeader>
          {folderView && (
            <>
              <DataTable>
                <thead>
                  <tr>
                    <Th sortable={false} className="w-10">
                      <input
                        type="checkbox"
                        aria-label="全选"
                        className="h-4 w-4 cursor-pointer accent-teal-600"
                        ref={(el) => {
                          const n = (submissionFolderFiles[folderView.id] ?? []).length
                          if (el) el.indeterminate = folderSel.size > 0 && folderSel.size < n
                        }}
                        checked={(submissionFolderFiles[folderView.id] ?? []).length > 0 && folderSel.size === (submissionFolderFiles[folderView.id] ?? []).length}
                        onChange={(e) =>
                          setFolderSel(
                            e.target.checked
                              ? new Set((submissionFolderFiles[folderView.id] ?? []).map((f) => f.name))
                              : new Set()
                          )
                        }
                      />
                    </Th>
                    <NameTh>文件名称</NameTh>
                    <Th sortable={false} className="w-28">文件大小</Th>
                    <Th sortable={false} className="w-20">操作</Th>
                  </tr>
                </thead>
                <tbody>
                  {(submissionFolderFiles[folderView.id] ?? []).map((f) => (
                    <Tr key={f.name}>
                      <Td className="w-10">
                        <input
                          type="checkbox"
                          aria-label={`选择 ${f.name}`}
                          className="h-4 w-4 cursor-pointer accent-teal-600"
                          checked={folderSel.has(f.name)}
                          onChange={(e) => setFolderSel((prev) => toggleIn(prev, f.name, e.target.checked))}
                        />
                      </Td>
                      <NameTd>
                        <span className="flex min-w-0 items-center gap-2.5">
                          <FileTypeIcon kind={f.kind} />
                          <span className="truncate text-gray-700">{f.name}</span>
                        </span>
                      </NameTd>
                      <Td>{f.size}</Td>
                      <Td>
                        <TealLink onClick={() => downloadFiles([f])}>下载</TealLink>
                      </Td>
                    </Tr>
                  ))}
                  {(submissionFolderFiles[folderView.id] ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-sm text-gray-400">
                        文件夹内暂无文件
                      </td>
                    </tr>
                  )}
                </tbody>
              </DataTable>
              <div className="mt-4 flex items-center justify-end gap-2">
                {folderSel.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-gray-400 hover:text-gray-600"
                    onClick={() => setFolderSel(new Set())}
                  >
                    <X className="h-3.5 w-3.5" /> 取消选择
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 border-teal-200 text-xs text-teal-600 hover:bg-teal-50 hover:text-teal-700"
                  onClick={() => {
                    const all = submissionFolderFiles[folderView.id] ?? []
                    downloadFiles(folderSel.size ? all.filter((f) => folderSel.has(f.name)) : all)
                    setFolderSel(new Set())
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> 下载{folderSel.size ? ` 所选（${folderSel.size}）` : ' 全部'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
