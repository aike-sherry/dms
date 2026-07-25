import { useState } from 'react'
import { Check, Download, FolderOpen, SquarePen, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageCard, DataTable, Th, Td, NameTd, Tr, FileTypeIcon, TealLink } from '@/components/common'
import { OverviewTable } from '@/pages/Submission'
import { submissionFolderFiles, submissionHospitals } from '@/data/mock'
import { EXECUTOR_CENTER, useStore, type Submission } from '@/store'

/** 执行人员所属中心对应的医院列名（如 上海瑞金医院 → 瑞金医院） */
const myHospital = submissionHospitals.find((h) => EXECUTOR_CENTER.includes(h))

/* 执行人员 SUBMISSION：递交文件只读（仅下载）；递交概况中本中心的递交日期可录入更新 */
export default function ExSubmission() {
  const { state, dispatch } = useStore()
  /* 递交文件列表带项目编号维度：静默跟随全局项目筛选（递交概况矩阵无项目维度，不过滤） */
  const project = state.activeProject
  const published = state.submissions.filter(
    (s) => s.published && (project === '全部' || s.projectNo.startsWith(project)),
  )
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [folderView, setFolderView] = useState<Submission | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [folderSel, setFolderSel] = useState<Set<string>>(new Set())

  const toggleIn = (set: Set<string>, key: string, checked: boolean) => {
    const next = new Set(set)
    if (checked) next.add(key)
    else next.delete(key)
    return next
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

  const startEdit = () => {
    const init: Record<string, string> = {}
    if (myHospital) {
      for (const r of state.submissionSchedule) init[`${r.id}|${myHospital}`] = r.dates[myHospital] ?? ''
    }
    setDraft(init)
    setEditing(true)
  }

  const save = () => {
    if (!myHospital) return
    const empty = Object.values(draft).filter((d) => !d).length
    dispatch({
      type: 'saveSubmissionDates',
      updates: Object.entries(draft).map(([key, date]) => {
        const [rowId, hospital] = key.split('|')
        return { rowId, hospital, date }
      }),
    })
    setEditing(false)
    toast.success('递交日期已更新', {
      description: empty > 0 ? `已保存，仍有 ${empty} 项待录入` : `${myHospital}全部递交主题日期已录入`,
    })
  }

  const cancel = () => {
    setEditing(false)
    setDraft({})
  }

  return (
    <div className="space-y-5">
      <PageCard
        title="递交概况"
        extra={
          editing ? (
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-8 gap-1 bg-teal-500 text-xs hover:bg-teal-600" onClick={save}>
                <Check className="h-3.5 w-3.5" /> 保存
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={cancel}>
                取消
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 border-teal-200 text-xs text-teal-600 hover:bg-teal-50 hover:text-teal-700"
              onClick={startEdit}
            >
              <SquarePen className="h-3.5 w-3.5" /> 更新
            </Button>
          )
        }
      >
        <OverviewTable
          editHospital={editing ? myHospital : undefined}
          draft={draft}
          onDateChange={(rowId, hospital, date) => setDraft((d) => ({ ...d, [`${rowId}|${hospital}`]: date }))}
        />
        {editing && (
          <p className="mt-3 text-xs text-gray-400">
            仅可录入本中心（{myHospital}）的递交日期，其他中心日期由对应执行人员维护。
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
              <Th sortable={false}>递交主题</Th>
              <Th>文件</Th>
              <Th>项目编号</Th>
              <Th>上传日期</Th>
              <Th>文件大小</Th>
              <Th sortable={false}>操作</Th>
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
                        className="text-left text-gray-700 underline decoration-teal-300 decoration-dotted underline-offset-4 transition-colors hover:text-teal-600"
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
                  暂无已发布的递交文件
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
                    <Th sortable={false}>文件名称</Th>
                    <Th sortable={false}>文件大小</Th>
                    <Th sortable={false}>操作</Th>
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
                        <span className="flex items-center gap-2.5">
                          <FileTypeIcon kind={f.kind} />
                          <span className="text-gray-700">{f.name}</span>
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
