import { useEffect, useRef, useState } from 'react'
import { FolderOpen, X, Maximize2, Plus, Trash2, Upload, FileCheck2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DataTable, Th, Td, Tr, TealLink } from '@/components/common'
import { catalogStudyRows, catalogSiteRows, type CatalogRow } from '@/data/mock'
import { useStore, nextId, todayStr, fmtSize, PM_USER, EXECUTOR_CENTER, type Catalog, type TmfFile } from '@/store'

/* 弹窗顶部信息字段（柔和卡片） */
export function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-800">{value}</div>
    </div>
  )
}

/* 弹窗 teal 渐变头部 */
export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-teal-400 to-teal-500 px-5 py-3.5">
      <div className="flex items-center gap-2 text-white">
        <FolderOpen className="h-4.5 w-4.5" />
        <span className="text-[15px] font-medium">{title}</span>
      </div>
      <div className="flex items-center gap-3 text-white/90">
        <Maximize2 className="h-4 w-4 cursor-pointer transition-opacity hover:opacity-70" />
        <X className="h-4.5 w-4.5 cursor-pointer transition-opacity hover:opacity-70" onClick={onClose} />
      </div>
    </div>
  )
}

export default function CatalogDialog({
  open,
  onOpenChange,
  type,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'study' | 'site'
}) {
  const { dispatch } = useStore()
  const [rows, setRows] = useState<CatalogRow[]>([])
  /* 各行「上传目录」从本地电脑选择的文件（Word / Excel / PDF） */
  const [filesByRow, setFilesByRow] = useState<Record<string, File[]>>({})
  const [pickRowId, setPickRowId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  /* 删除选择模式：勾选行后批量删除，可取消 */
  const [delMode, setDelMode] = useState(false)
  const [delSel, setDelSel] = useState<Set<string>>(new Set())
  const enterDel = () => {
    setDelMode(true)
    setDelSel(new Set())
  }
  const exitDel = () => {
    setDelMode(false)
    setDelSel(new Set())
  }
  const toggleDel = (id: string) =>
    setDelSel((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const confirmDel = () => {
    const n = delSel.size
    setRows((prev) => prev.filter((r) => !delSel.has(r.id)))
    setFilesByRow((prev) => {
      const next = { ...prev }
      for (const id of delSel) delete next[id]
      return next
    })
    toast.success(`已删除 ${n} 行`)
    exitDel()
  }

  useEffect(() => {
    if (open) {
      setRows(type === 'study' ? [...catalogStudyRows] : [...catalogSiteRows])
      setFilesByRow({})
      setPickRowId(null)
      exitDel()
    }
  }, [open, type])

  /* 打开本地文件选择：记录目标行 */
  const pickForRow = (rowId: string) => {
    setPickRowId(rowId)
    fileInputRef.current?.click()
  }

  const onPicked = (list: FileList | null) => {
    if (!list || list.length === 0 || !pickRowId) return
    setFilesByRow((prev) => ({ ...prev, [pickRowId]: [...(prev[pickRowId] ?? []), ...Array.from(list)] }))
    toast.success(`已添加 ${list.length} 个文件`, { description: '支持 Word / Excel / PDF 文档' })
  }

  const clearPicked = (rowId: string) => {
    setFilesByRow((prev) => ({ ...prev, [rowId]: [] }))
  }

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: nextId('cat-row'),
        projectNo: '',
        site: type === 'site' ? '上海瑞金医院' : undefined,
        folderName: '',
        isNew: true,
      },
    ])
  }

  const updateRow = (id: string, patch: Partial<CatalogRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  /* 提交创建：目录同步写入 store，PM 与执行端 SITE TMF 均可见；各行已选文件随之归档进新目录 */
  const submitCatalogs = () => {
    const valid = rows.filter((r) => r.folderName.trim() !== '')
    if (valid.length === 0) {
      toast.warning('请至少填写一个文件夹名称')
      return
    }
    const files: TmfFile[] = []
    const catalogs: Catalog[] = valid.map((r) => {
      const catId = nextId('cat')
      const projectNo = r.projectNo || 'ON101CL01'
      const center = type === 'site' ? (r.site ?? r.folderName.split('—')[1]) : undefined
      const rowFiles = filesByRow[r.id] ?? []
      const totalBytes = rowFiles.reduce((s, f) => s + f.size, 0)
      for (const fl of rowFiles) {
        files.push({
          id: nextId('f'),
          name: fl.name,
          kind: 'pdf',
          projectNo,
          center: center ?? EXECUTOR_CENTER,
          uploader: PM_USER.name,
          uploadDate: todayStr(),
          size: fmtSize(fl.size),
          status: 'archived',
          folderId: catId,
        })
      }
      return {
        id: catId,
        kind: type,
        name: r.folderName,
        projectNo,
        center,
        creator: '王进',
        createDate: todayStr(),
        updateDate: todayStr(),
        size: totalBytes > 0 ? `${(totalBytes / 1024).toFixed(1)}KM` : '0KB',
        status: '未完成' as const,
      }
    })
    dispatch({ type: 'addCatalogs', catalogs })
    if (files.length > 0) dispatch({ type: 'addFiles', files })
    toast.success('目录创建成功', {
      description:
        files.length > 0
          ? `已创建 ${catalogs.length} 个目录，${files.length} 个文件已归档至对应目录`
          : type === 'site'
            ? '已同步至执行人员 SITE TMF 文件管理页'
            : `已创建 ${catalogs.length} 个目录`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`gap-0 overflow-hidden rounded-2xl border-0 p-0 ${
          type === 'site' ? 'sm:max-w-4xl' : 'sm:max-w-2xl'
        }`}
      >
        <DialogTitle className="sr-only">目录创建</DialogTitle>
        <ModalHeader title="目录创建" onClose={() => onOpenChange(false)} />

        <div className="max-h-[calc(85vh-52px)] overflow-y-auto p-5">
          {/* 信息字段 */}
          <div className="mb-5 grid grid-cols-4 gap-3">
            <InfoField label="创建人" value="王进" />
            <InfoField label="职位" value="项目经理" />
            <InfoField label="创建日期" value="2026-03-12" />
            <InfoField label="目录数量" value={String(rows.length)} />
          </div>

          {/* 列表 */}
          <div className="rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">列表</span>
              <div className="flex items-center gap-2">
                {delMode ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() =>
                        setDelSel(delSel.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))
                      }
                    >
                      {delSel.size === rows.length ? '取消全选' : '全选'}
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={exitDel}>
                      取消
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 gap-1 bg-red-500 text-xs text-white hover:bg-red-600"
                      disabled={delSel.size === 0}
                      onClick={confirmDel}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> 确认删除（{delSel.size}）
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addRow}>
                      <Plus className="h-3.5 w-3.5" /> 新建
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={enterDel}
                      disabled={rows.length === 0}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> 删除
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={submitCatalogs}
                    >
                      <Upload className="h-3.5 w-3.5" /> 上传
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
            <DataTable>
              <thead>
                <tr>
                  {delMode && <Th sortable={false} className="w-8" />}
                  <Th sortable={false}>项目编号</Th>
                  {type === 'site' && <Th sortable={false}>研究中心</Th>}
                  <Th sortable={false}>文件夹名称</Th>
                  <Th sortable={false}>导入目录</Th>
                  <Th sortable={false}>命名设置</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr
                    key={row.id}
                    className={delMode && delSel.has(row.id) ? 'bg-red-50/60' : undefined}
                  >
                    {delMode && (
                      <Td>
                        <input
                          type="checkbox"
                          checked={delSel.has(row.id)}
                          onChange={() => toggleDel(row.id)}
                          className="h-4 w-4 accent-red-500"
                        />
                      </Td>
                    )}
                    <Td>
                      {row.isNew ? (
                        <input
                          autoFocus
                          value={row.projectNo}
                          onChange={(e) => updateRow(row.id, { projectNo: e.target.value })}
                          placeholder="项目编号"
                          className="w-28 rounded-md border border-teal-300 px-2 py-1 text-sm outline-none focus:border-teal-500"
                        />
                      ) : (
                        row.projectNo
                      )}
                    </Td>
                    {type === 'site' && <Td>{row.site}</Td>}
                    <Td>
                      {row.isNew ? (
                        <input
                          value={row.folderName}
                          onChange={(e) => updateRow(row.id, { folderName: e.target.value })}
                          placeholder="文件夹名称"
                          className="w-52 rounded-md border border-teal-300 px-2 py-1 text-sm outline-none focus:border-teal-500"
                        />
                      ) : (
                        row.folderName
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-col items-center gap-1.5">
                        <TealLink onClick={() => pickForRow(row.id)}>上传目录</TealLink>
                        {(filesByRow[row.id]?.length ?? 0) > 0 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] text-teal-700 ring-1 ring-teal-100"
                            title={filesByRow[row.id].map((f) => f.name).join('、')}
                          >
                            <FileCheck2 className="h-3 w-3" />
                            已选 {filesByRow[row.id].length} 个
                            <button
                              type="button"
                              title="清空已选文件"
                              onClick={() => clearPicked(row.id)}
                              className="text-teal-400 transition-colors hover:text-red-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <TealLink onClick={() => toast.success('命名设置已打开')}>命名设置</TealLink>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
            </div>
          </div>
        </div>

        {/* 本地文件选择：Word / Excel / PDF，可多选，归属当前点击行 */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".doc,.docx,.xls,.xlsx,.pdf"
          className="hidden"
          onChange={(e) => {
            onPicked(e.target.files)
            e.target.value = ''
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
