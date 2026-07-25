import { useEffect, useState } from 'react'
import { Plus, Trash2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DataTable, Th, Td, Tr, TealLink } from '@/components/common'
import { InfoField, ModalHeader } from '@/components/CatalogDialog'
import { newSubmissionRows, type NewSubmissionRow } from '@/data/mock'
import { useStore, nextId, todayStr } from '@/store'

export default function SubmissionDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { dispatch } = useStore()
  const [rows, setRows] = useState<NewSubmissionRow[]>([])

  useEffect(() => {
    if (open) setRows([...newSubmissionRows])
  }, [open])

  const addRow = () => {
    setRows((prev) => [...prev, { id: nextId('sub'), topic: '', projectNo: '', deadline: '', isNew: true }])
  }

  const removeLast = () => {
    if (rows.length === 0) {
      toast.warning('列表已为空')
      return
    }
    setRows((prev) => prev.slice(0, -1))
    toast.success('已删除一行')
  }

  const updateRow = (id: string, patch: Partial<NewSubmissionRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const submit = () => {
    const valid = rows.filter((r) => r.topic.trim() !== '')
    if (valid.length === 0) {
      toast.warning('请至少填写一条递交主题')
      return
    }
    dispatch({
      type: 'addSubmissions',
      submissions: valid.map((r) => ({
        id: nextId('s'),
        topic: r.topic,
        fileName: r.topic,
        kind: 'pdf' as const,
        projectNo: r.projectNo || 'ON101CLK0912',
        uploadDate: todayStr(),
        size: '193.1KM',
        published: false,
      })),
    })
    toast.success('递交创建成功', { description: `已新增 ${valid.length} 条递交记录，发布后执行端可见` })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-2xl"
      >
        <DialogTitle className="sr-only">新建递交</DialogTitle>
        <ModalHeader title="新建递交" onClose={() => onOpenChange(false)} />

        <div className="p-5">
          <div className="mb-5 grid grid-cols-3 gap-4">
            <InfoField label="创建人" value="王进" />
            <InfoField label="职位" value="项目经理" />
            <InfoField label="创建日期" value="2026-03-12" />
          </div>

          <div className="rounded-xl border border-gray-100 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">列表</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addRow}>
                  <Plus className="h-3.5 w-3.5" /> 新建
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={removeLast}>
                  <Trash2 className="h-3.5 w-3.5" /> 删除
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={submit}>
                  <Send className="h-3.5 w-3.5" /> 提交
                </Button>
              </div>
            </div>

            <DataTable>
              <thead>
                <tr>
                  <Th sortable={false}>递交主题</Th>
                  <Th sortable={false}>项目编号</Th>
                  <Th sortable={false}>目标时限</Th>
                  <Th sortable={false}>操作</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      {row.isNew ? (
                        <input
                          autoFocus
                          value={row.topic}
                          onChange={(e) => updateRow(row.id, { topic: e.target.value })}
                          placeholder="递交主题"
                          className="w-44 rounded-md border border-teal-300 px-2 py-1 text-sm outline-none focus:border-teal-500"
                        />
                      ) : (
                        row.topic
                      )}
                    </Td>
                    <Td>
                      {row.isNew ? (
                        <input
                          value={row.projectNo}
                          onChange={(e) => updateRow(row.id, { projectNo: e.target.value })}
                          placeholder="项目编号"
                          className="w-32 rounded-md border border-teal-300 px-2 py-1 text-sm outline-none focus:border-teal-500"
                        />
                      ) : (
                        row.projectNo
                      )}
                    </Td>
                    <Td>
                      {row.isNew ? (
                        <input
                          value={row.deadline}
                          onChange={(e) => updateRow(row.id, { deadline: e.target.value })}
                          placeholder="YYYY-MM-DD"
                          className="w-28 rounded-md border border-teal-300 px-2 py-1 text-sm outline-none focus:border-teal-500"
                        />
                      ) : (
                        row.deadline
                      )}
                    </Td>
                    <Td>
                      <TealLink onClick={() => toast.success('文件上传成功')}>文件上传</TealLink>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
