import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { FileUp, FolderUp, MousePointerClick } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileTypeIcon, ToolbarSelect } from '@/components/common'
import { ModalHeader } from '@/components/CatalogDialog'
import { cn } from '@/lib/utils'
import {
  analyzeName,
  applyNamingTemplate,
  autoNameBatch,
  dedupName,
  DOC_TYPE_NAMES,
  notifyAutoName,
  resolveChainVersion,
  type ChainResolution,
} from '@/lib/smartDoc'
import { useStore, nextId, todayStr, fmtSize, EXECUTOR_NAME, EXECUTOR_CENTER, type TmfFile } from '@/store'

const FALLBACK_PROJECTS = ['ON101CL01', 'ON101CL103', 'ON101CLCT01']

/** 待确认命名的文件项：file 为原始 File，relName 用于识别分析（文件夹上传时为文件夹内相对路径） */
interface PendingItem {
  file: File
  relName: string
}

/** 上传弹窗：卡片式选择「上传文件 / 上传文件夹」，支持拖拽上传（自动识别文件夹）；
    项目编号必选，取自 STUDY TMF 目录，归档时按编号进入对应项目文件夹。
    withNamingConfirm（执行端 CRA）：单页流程——顶部选择项目编号与研究中心，选文件后已选文件
    在同页逐行确认目标文档（从 PM 在该中心 SITE TMF 目录下已建的文件夹名中选择，按文件名预选、可改选），
    系统按命名规则模板实时预览规范文件名，底部「取消 / 确认上传」；
    不带该 prop（PM）：上传即自动命名（同样按模板渲染），无确认步骤。
    lockProjectNo（钻取视图内上传）：项目编号锁定为文件夹所属项目（下拉禁用并提示），
    fixedParentId：上传结果挂为该文件夹的子级 */
export default function UploadDialog({
  open,
  onOpenChange,
  uploader = EXECUTOR_NAME,
  center = EXECUTOR_CENTER,
  withNamingConfirm = false,
  lockProjectNo,
  fixedParentId,
  autoPick = null,
  preset = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  uploader?: string
  center?: string
  withNamingConfirm?: boolean
  lockProjectNo?: string
  fixedParentId?: string
  /** R34 工具栏下拉直达：打开弹窗后自动弹出对应系统选择框（文件 / 文件夹） */
  autoPick?: 'files' | 'dir' | null
  /** R34 页面级拖拽带入：预选文件进入暂存确认流（PM 模式底部确认上传；CRA 走原确认命名） */
  preset?: { items: PendingItem[]; dirRoot: string | null } | null
}) {
  const { state, dispatch } = useStore()
  const [projectNo, setProjectNo] = useState(lockProjectNo ?? '')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)
  /* CRA 单页确认命名：centerSel 为当前所选研究中心（默认本中心，可切换为该 CRA 可见的其他中心）；
     pending 为已选待命名文件，selections 记录每行所选目标文档 */
  const [centerSel, setCenterSel] = useState(center)
  const [pending, setPending] = useState<PendingItem[]>([])
  const [dirRoot, setDirRoot] = useState<string | null>(null)
  const [selections, setSelections] = useState<Record<number, string>>({})
  /* R34 PM 暂存确认流：页面拖拽/暂存态下选择的文件先进入 staged，底部「确认上传」一次性落库 */
  const [staged, setStaged] = useState<PendingItem[] | null>(null)
  const [stagedRoot, setStagedRoot] = useState<string | null>(null)
  /* R27 PM 目标文件夹级联：选项目编号后可选该项目 STUDY TMF 目录的一级/二级文件夹，
     选中后上传文件带 targetFolderId，「归档」时直通该文件夹（沿用 archiveRouter 直通机制） */
  const [targetL1, setTargetL1] = useState('')
  const [targetL2, setTargetL2] = useState('')

  /* 弹窗每次打开时重置研究中心为本中心与目标文件夹选择；锁定项目编号时同步锁定值；
     R34：页面拖拽带入 preset → PM 进入暂存确认流；CRA（withNamingConfirm）直接进 pending 确认命名 */
  useEffect(() => {
    if (open) {
      setCenterSel(center)
      setTargetL1('')
      setTargetL2('')
      if (preset && preset.items.length > 0) {
        if (withNamingConfirm) {
          stageItems(preset.items, preset.dirRoot)
          setStaged(null)
          setStagedRoot(null)
        } else {
          setStaged(preset.items)
          setStagedRoot(preset.dirRoot)
        }
      } else {
        setStaged(null)
        setStagedRoot(null)
      }
    }
    if (open && lockProjectNo) setProjectNo(lockProjectNo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, center, lockProjectNo, preset])

  /* R34 工具栏下拉直达：打开后自动弹系统选择框（已选项目编号才弹，否则提示先选项目） */
  useEffect(() => {
    if (!open || !autoPick) return
    if (!projectNo) {
      toast.warning('请先选择项目编号', { description: '上传前需指定文件归属的项目，用于归档' })
      return
    }
    const t = setTimeout(() => {
      if (autoPick === 'files') fileInputRef.current?.click()
      else dirInputRef.current?.click()
    }, 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoPick])

  /* 项目编号变更 → 目标文件夹级联重置 */
  useEffect(() => {
    setTargetL1('')
    setTargetL2('')
  }, [projectNo])

  /* 项目编号选项：动态取自 STUDY TMF 目录（归档目标），空时回退默认 */
  const projectChoices = useMemo(() => {
    const fromCatalogs = [...new Set(state.catalogs.filter((c) => c.kind === 'study').map((c) => c.projectNo))]
    return fromCatalogs.length > 0 ? fromCatalogs : FALLBACK_PROJECTS
  }, [state.catalogs])

  /* R32 研究中心选项：注册表中心名去重（全系统唯一数据源），保证本中心在列并默认预选；
     空注册表时回退仅本中心，并在下方显示「请先在首页配置」引导 */
  const centerChoices = useMemo(() => {
    const registry = [...new Set(state.centers.map((c) => c.name))]
    const all = registry.length > 0 ? registry : [center]
    return all.includes(center) ? all : [center, ...all]
  }, [state.centers, center])

  /* 目标文档选项：该中心 + 所选项目的 SITE TMF 目录下 PM 已建的文件夹名（文件夹名即文档类型词表）；
     该中心没有任何文件夹时回退到 18 个标准文档类型名。
     pmFolderMap 保留 名称 → 文件夹对象 映射（同名取第一个），确认上传时把真实文件夹 id 写入 targetFolderId，
     审核通过后直接归档进该文件夹（选回退标准类型时无映射、不写入） */
  const pmFolderMap = useMemo(() => {
    const map = new Map<string, TmfFile>()
    if (!projectNo) return map
    const cat = state.catalogs.find((c) => c.kind === 'site' && c.projectNo === projectNo && c.center === centerSel)
    if (!cat) return map
    for (const f of state.files.filter((x) => x.kind === 'folder' && x.folderId === cat.id)) {
      if (!map.has(f.name)) map.set(f.name, f)
    }
    return map
  }, [state.catalogs, state.files, projectNo, centerSel])
  const pmFolders = useMemo(() => [...pmFolderMap.keys()].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')), [pmFolderMap])
  const docOptions = pmFolders.length > 0 ? pmFolders : DOC_TYPE_NAMES

  /* 项目或中心变更 → 目标文档选项刷新：已选但不在新选项中的清空重选 */
  useEffect(() => {
    setSelections((prev) => {
      let changed = false
      const next = { ...prev }
      for (const k of Object.keys(next)) {
        const key = Number(k)
        if (next[key] && !docOptions.includes(next[key])) {
          next[key] = ''
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [docOptions])

  /* R27 PM 目标文件夹级联数据：该项目（精确编号）STUDY TMF 目录下的一/二级已归档文件夹 */
  const studyCat = useMemo(
    () =>
      withNamingConfirm || !projectNo
        ? undefined
        : state.catalogs.find((c) => c.kind === 'study' && c.projectNo === projectNo),
    [state.catalogs, projectNo, withNamingConfirm],
  )
  const l1Folders = useMemo(
    () =>
      studyCat
        ? state.files.filter(
            (x) => x.kind === 'folder' && x.status === 'archived' && x.folderId === studyCat.id && !x.parentId,
          )
        : [],
    [state.files, studyCat],
  )
  const l2Folders = useMemo(
    () =>
      targetL1
        ? state.files.filter((x) => x.kind === 'folder' && x.status === 'archived' && x.parentId === targetL1)
        : [],
    [state.files, targetL1],
  )
  const targetFolderId = targetL2 || targetL1 || undefined

  const requireProject = () => {
    if (!projectNo) {
      toast.warning('请先选择项目编号', { description: '上传前需指定文件归属的项目，用于归档' })
      return false
    }
    return true
  }

  /* R27：PM 项目级上传不涉及研究中心（center 置空，命名模板 {研究中心} 占位符自动优雅降级）；CRA 端仍为所选中心 */
  const baseFields = () => ({
    projectNo,
    center: withNamingConfirm ? centerSel : '',
    uploader,
    uploadDate: todayStr(),
    status: 'uploaded' as const,
  })

  const resetAll = () => {
    setPending([])
    setDirRoot(null)
    setSelections({})
    setStaged(null)
    setStagedRoot(null)
  }
  const close = (o: boolean) => {
    if (!o) resetAll()
    onOpenChange(o)
  }

  /* 暂存已选文件：按 analyzeName 命中的 docType 与文件夹名做包含匹配预选，未命中不选；
     同一来源（同为散文件或同一文件夹）再次选文件时追加，否则替换（防止文件夹与散文件混杂） */
  const stageItems = (items: PendingItem[], root: string | null) => {
    const appending = root === dirRoot && pending.length > 0
    const merged = appending ? [...pending, ...items] : items
    const sels: Record<number, string> = {}
    merged.forEach((it, i) => {
      if (appending && i < pending.length) {
        sels[i] = selections[i] ?? ''
        return
      }
      const a = analyzeName(it.relName)
      sels[i] = a.matched ? (docOptions.find((o) => o.includes(a.docType) || a.docType.includes(o)) ?? '') : ''
    })
    setPending(merged)
    setDirRoot(root)
    setSelections(sels)
  }

  /* 逐行新文件名预览：按模板实时渲染；版本沿用版本链（同项目同中心同文档类型历史最大版 +1），
     批内同文档类型依次递增（pool/siblings 随行累积） */
  const previews = useMemo<Array<{ name: string; chain: ChainResolution } | null>>(() => {
    if (!withNamingConfirm || pending.length === 0) return []
    const pool: TmfFile[] = [...state.files]
    const siblings = state.files.map((f) => f.name)
    return pending.map((p, i) => {
      const sel = selections[i]
      if (!sel) return null
      const a = analyzeName(p.relName)
      const docType = analyzeName(sel).docType || sel
      const chain = resolveChainVersion(p.relName, docType, { files: pool, projectNo, center: centerSel })
      const name = dedupName(
        applyNamingTemplate(state.namingTemplate, {
          projectNo,
          docType: sel,
          version: chain.version,
          date: a.date ?? todayStr(),
          center: centerSel,
        }),
        siblings,
      )
      siblings.push(name)
      pool.push({ id: '', name, kind: 'pdf', projectNo, center: centerSel, uploader, uploadDate: todayStr(), size: '', status: 'uploaded' })
      return { name, chain }
    })
  }, [withNamingConfirm, pending, selections, state.files, state.namingTemplate, projectNo, centerSel, uploader])

  const allSelected = pending.length > 0 && pending.every((_, i) => !!selections[i])

  /* 确认上传：按模板渲染结果落库（版本链关联历史版本），文件夹上传时文件夹名不变、子文件挂为其子级；
     目标文档对应真实 PM 文件夹时写入 targetFolderId（审核通过后直接归档进该文件夹） */
  const confirmNaming = () => {
    if (!allSelected) {
      toast.warning('请为每个文件选择目标文档', { description: '未选择目标文档的文件无法按规则命名' })
      return
    }
    const folderId = dirRoot ? nextId('f') : undefined
    const files: TmfFile[] = pending.map((p, i) => {
      const target = pmFolderMap.get(selections[i])
      return {
        id: nextId('f'),
        name: previews[i]?.name ?? p.relName,
        kind: 'pdf' as const,
        ...baseFields(),
        size: fmtSize(p.file.size),
        /* 挂接父级：文件夹上传归入新建文件夹；钻取视图内上传（fixedParentId）挂为当前文件夹子级 */
        ...(folderId ?? fixedParentId ? { parentId: (folderId ?? fixedParentId) as string } : {}),
        ...(previews[i]?.chain.versionOf ? { versionOf: previews[i].chain.versionOf } : {}),
        ...(target ? { targetFolderId: target.id } : {}),
      }
    })
    if (dirRoot && folderId) {
      const folder: TmfFile = {
        id: folderId,
        name: dirRoot,
        kind: 'folder',
        ...baseFields(),
        size: fmtSize(pending.reduce((s, p) => s + p.file.size, 0)),
        /* 钻取视图内上传文件夹：新文件夹同样挂为当前文件夹子级 */
        ...(fixedParentId ? { parentId: fixedParentId } : {}),
      }
      dispatch({ type: 'addFiles', files: [folder, ...files] })
    } else {
      dispatch({ type: 'addFiles', files })
    }
    notifyAutoName({
      title: dirRoot ? `已上传文件夹「${dirRoot}」（${files.length} 个文件）` : `已上传 ${files.length} 个文件`,
      renamed: pending.map((p, i) => `${p.relName} → ${previews[i]?.name ?? p.relName}`),
      unmatched: 0,
      extra: `项目编号：${projectNo}，已按命名规则生成规范文件名`,
      versionNotes: previews
        .map((pv) => (pv?.chain.prevVersion ? `检测到历史版本 ${pv.chain.prevVersion}，已命名为 ${pv.name} 并关联历史版本` : ''))
        .filter((s): s is string => !!s),
    })
    resetAll()
    onOpenChange(false)
  }

  /* 上传文件（可多选）：一律视为文档，项目编号取自下拉；PM 上传即自动命名（按命名规则模板渲染，
     未识别保留原名归档时进 99 待分拣；版本链自动递增）；CRA 暂存并在同页确认命名。
     R34：PM 暂存确认流（staged 激活）中再选文件 → 追加进暂存列表，不立即落库 */
  const importFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return
    if (!requireProject()) return
    if (withNamingConfirm) {
      stageItems(Array.from(list).map((f) => ({ file: f, relName: f.name })), null)
      return
    }
    if (staged) {
      const arr = Array.from(list).map((f) => ({ file: f, relName: f.name }))
      setStaged((prev) => [...(prev ?? []), ...arr.filter((a) => !(prev ?? []).some((p) => p.relName === a.relName))])
      return
    }
    const results = autoNameBatch(
      Array.from(list).map((f) => f.name),
      state.files.map((f) => f.name),
      { files: state.files, projectNo, center: '', template: state.namingTemplate, today: todayStr() },
    )
    const files: TmfFile[] = Array.from(list).map((f, i) => ({
      id: nextId('f'),
      name: results[i].name,
      kind: 'pdf' as const,
      ...baseFields(),
      size: fmtSize(f.size),
      /* R27：PM 选定目标文件夹 → 文件带 targetFolderId，归档时直通（未选则走路由表/待分拣） */
      ...(targetFolderId ? { targetFolderId } : {}),
      ...(results[i].versionOf ? { versionOf: results[i].versionOf } : {}),
    }))
    dispatch({ type: 'addFiles', files })
    notifyAutoName({
      title: `已上传 ${files.length} 个文件`,
      renamed: results.filter((r) => r.renamed).map((r) => `${r.from} → ${r.name}`),
      unmatched: results.filter((r) => !r.matched).length,
      extra: `项目编号：${projectNo}`,
      versionNotes: results
        .filter((r) => r.prevVersion)
        .map((r) => `检测到历史版本 ${r.prevVersion}，已命名为 ${r.name} 并关联历史版本`),
    })
    onOpenChange(false)
  }

  /* 上传文件夹：创建文件夹条目，内部文件作为其子文件（保留结构，归档时级联）；
     文件夹名保持不变，内部子文件逐个自动命名（CRA 逐个确认命名） */
  const importDir = (list: FileList | null) => {
    if (!list || list.length === 0) return
    if (!requireProject()) return
    const arr = Array.from(list)
    const rootName = arr[0]?.webkitRelativePath?.split('/')[0] || '新建文件夹'
    if (withNamingConfirm) {
      stageItems(
        arr.map((f) => {
          const rel = f.webkitRelativePath
          return { file: f, relName: rel && rel.includes('/') ? rel.split('/').slice(1).join('/') : f.name }
        }),
        rootName,
      )
      return
    }
    if (staged) {
      const items = arr.map((f) => {
        const rel = f.webkitRelativePath
        return { file: f, relName: rel && rel.includes('/') ? rel.split('/').slice(1).join('/') : f.name }
      })
      setStaged((prev) => [...(prev ?? []), ...items.filter((a) => !(prev ?? []).some((p) => p.relName === a.relName))])
      setStagedRoot((prev) => prev ?? rootName)
      return
    }
    const folderId = nextId('f')
    const results = autoNameBatch(
      arr.map((f) => {
        const rel = f.webkitRelativePath
        return rel && rel.includes('/') ? rel.split('/').slice(1).join('/') : f.name
      }),
      state.files.map((f) => f.name),
      { files: state.files, projectNo, center: '', template: state.namingTemplate, today: todayStr() },
    )
    const children: TmfFile[] = arr.map((f, i) => ({
      id: nextId('f'),
      name: results[i].name,
      kind: 'pdf' as const,
      ...baseFields(),
      size: fmtSize(f.size),
      parentId: folderId,
      ...(results[i].versionOf ? { versionOf: results[i].versionOf } : {}),
    }))
    const folder: TmfFile = {
      id: folderId,
      name: rootName,
      kind: 'folder',
      ...baseFields(),
      size: fmtSize(arr.reduce((s, f) => s + f.size, 0)),
      /* R27：PM 选定目标文件夹 → 文件夹条目带 targetFolderId，归档时连同子文件整体直通（archiveRouter） */
      ...(targetFolderId ? { targetFolderId } : {}),
    }
    dispatch({ type: 'addFiles', files: [folder, ...children] })
    notifyAutoName({
      title: `已上传文件夹「${rootName}」（${children.length} 个文件）`,
      renamed: results.filter((r) => r.renamed).map((r) => `${r.from} → ${r.name}`),
      unmatched: results.filter((r) => !r.matched).length,
      extra: `项目编号：${projectNo}，归档时文件夹将整体进入该项目 STUDY TMF`,
      versionNotes: results
        .filter((r) => r.prevVersion)
        .map((r) => `检测到历史版本 ${r.prevVersion}，已命名为 ${r.name} 并关联历史版本`),
    })
    onOpenChange(false)
  }

  /* R34 PM 暂存确认流：底部「确认上传」——暂存文件按命名规则一次性自动命名落库
     （stagedRoot 存在时按文件夹上传语义：建文件夹条目、子文件挂为其子级、文件夹名不变） */
  const confirmStaged = () => {
    if (!staged || staged.length === 0) {
      toast.warning('暂存列表为空')
      return
    }
    if (!requireProject()) return
    const results = autoNameBatch(
      staged.map((p) => p.relName),
      state.files.map((f) => f.name),
      { files: state.files, projectNo, center: '', template: state.namingTemplate, today: todayStr() },
    )
    const folderId = stagedRoot ? nextId('f') : undefined
    const children: TmfFile[] = staged.map((p, i) => ({
      id: nextId('f'),
      name: results[i].name,
      kind: 'pdf' as const,
      ...baseFields(),
      size: fmtSize(p.file.size),
      ...(folderId ?? fixedParentId ? { parentId: (folderId ?? fixedParentId) as string } : {}),
      ...(targetFolderId ? { targetFolderId } : {}),
      ...(results[i].versionOf ? { versionOf: results[i].versionOf } : {}),
    }))
    if (stagedRoot && folderId) {
      const folder: TmfFile = {
        id: folderId,
        name: stagedRoot,
        kind: 'folder',
        ...baseFields(),
        size: fmtSize(staged.reduce((s, p) => s + p.file.size, 0)),
        ...(fixedParentId ? { parentId: fixedParentId } : {}),
        ...(targetFolderId ? { targetFolderId } : {}),
      }
      dispatch({ type: 'addFiles', files: [folder, ...children] })
    } else {
      dispatch({ type: 'addFiles', files: children })
    }
    notifyAutoName({
      title: stagedRoot ? `已上传文件夹「${stagedRoot}」（${children.length} 个文件）` : `已上传 ${children.length} 个文件`,
      renamed: results.filter((r) => r.renamed).map((r) => `${r.from} → ${r.name}`),
      unmatched: results.filter((r) => !r.matched).length,
      extra: `项目编号：${projectNo}${stagedRoot ? '，归档时文件夹将整体进入该项目 STUDY TMF' : ''}`,
      versionNotes: results
        .filter((r) => r.prevVersion)
        .map((r) => `检测到历史版本 ${r.prevVersion}，已命名为 ${r.name} 并关联历史版本`),
    })
    resetAll()
    onOpenChange(false)
  }

  /* 拖拽上传：含相对路径的按文件夹导入，否则按文件导入 */
  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    const hasDir = Array.from(files).some((f) => f.webkitRelativePath && f.webkitRelativePath.includes('/'))
    if (hasDir) importDir(files)
    else importFiles(files)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        showCloseButton={false}
        className={cn('gap-0 overflow-hidden rounded-2xl border-0 p-0', withNamingConfirm ? 'sm:max-w-3xl' : 'sm:max-w-2xl')}
      >
        <DialogTitle className="sr-only">上传文件</DialogTitle>
        <ModalHeader title="上传文件" onClose={() => close(false)} />

        <div className="space-y-5 p-6">
          {/* 顶部一行：项目编号（必选，归档目标）+ 研究中心（仅 CRA 下拉可切换；R27 起 PM 项目级上传不再显示中心） */}
          <div
            className={cn(
              'flex items-center gap-3 rounded-xl px-4 py-3 ring-1 transition-colors',
              projectNo ? 'bg-gray-50 ring-gray-100' : 'bg-amber-50/60 ring-amber-200',
            )}
          >
            <span className="text-sm whitespace-nowrap text-gray-600">
              项目编号 <span className="text-red-400">*</span>
            </span>
            {lockProjectNo ? (
              /* 钻取视图内上传：项目编号锁定继承文件夹所属项目（禁用态下拉 + 提示） */
              <>
                <select
                  disabled
                  value={projectNo}
                  className="w-56 cursor-not-allowed appearance-none rounded-lg border border-gray-200 bg-gray-100 py-1.5 pr-7 pl-3 text-sm text-gray-500 outline-none"
                >
                  <option value={projectNo}>{projectNo}</option>
                </select>
                <span className="text-xs text-gray-400">继承文件夹所属项目</span>
              </>
            ) : (
              <ToolbarSelect
                value={projectNo}
                onChange={setProjectNo}
                options={[{ label: '请选择项目编号', value: '' }, ...projectChoices.map((p) => ({ label: p, value: p }))]}
                className="w-56 [&>select]:w-full"
              />
            )}
            {withNamingConfirm && (
              <>
                <span className="ml-auto text-sm whitespace-nowrap text-gray-600">研究中心</span>
                <ToolbarSelect
                  value={centerSel}
                  onChange={setCenterSel}
                  options={centerChoices.map((c) => ({ label: c, value: c }))}
                  className="w-44 [&>select]:w-full"
                />
              </>
            )}
          </div>

          {/* R32 空注册表引导：CRA 上传弹窗中心下拉无注册表数据时提示 */}
          {withNamingConfirm && state.centers.length === 0 && (
            <p className="rounded-lg bg-amber-50/70 px-3 py-2 text-xs text-amber-600 ring-1 ring-amber-100">
              尚未配置研究中心：请先在首页「研究中心管理」中添加（当前仅可选择本中心）
            </p>
          )}

          {/* R27 PM 目标文件夹级联（可选）：一级下拉 → 有子级时再出二级下拉；
              未建目录/无文件夹时提示并允许不选（沿用归档路由 + 99 待分拣逻辑） */}
          {!withNamingConfirm && projectNo && (
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
              <span className="text-sm whitespace-nowrap text-gray-600">目标文件夹</span>
              {!studyCat ? (
                <span className="text-xs text-amber-500">
                  该项目暂未创建目录，可先不选（归档时按规则路由，未识别进 99 待分拣）
                </span>
              ) : l1Folders.length === 0 ? (
                <span className="text-xs text-gray-400">该项目目录下暂无文件夹，可不选（归档时按规则路由）</span>
              ) : (
                <>
                  <ToolbarSelect
                    value={targetL1}
                    onChange={(v) => {
                      setTargetL1(v)
                      setTargetL2('')
                    }}
                    options={[
                      { label: '不选（按归档规则路由）', value: '' },
                      ...l1Folders.map((f) => ({ label: f.name, value: f.id })),
                    ]}
                    className="w-52 [&>select]:w-full"
                  />
                  {targetL1 && l2Folders.length > 0 && (
                    <ToolbarSelect
                      value={targetL2}
                      onChange={setTargetL2}
                      options={[
                        { label: '（直接放一级文件夹下）', value: '' },
                        ...l2Folders.map((f) => ({ label: f.name, value: f.id })),
                      ]}
                      className="w-52 [&>select]:w-full"
                    />
                  )}
                  {targetFolderId && (
                    <span className="text-xs whitespace-nowrap text-teal-600">归档时将直通该文件夹</span>
                  )}
                </>
              )}
            </div>
          )}

          {/* 卡片式上传入口 + 拖拽区 */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'grid grid-cols-2 gap-4 rounded-2xl p-1.5 transition-all',
              dragOver && 'bg-teal-50/70 ring-2 ring-teal-300 ring-offset-2'
            )}
          >
            <button
              type="button"
              onClick={() => requireProject() && fileInputRef.current?.click()}
              className="group flex h-44 flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-gray-200 bg-[#fafbfc] transition-all hover:border-teal-300 hover:bg-teal-50/40 hover:shadow-sm"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600 transition-transform group-hover:scale-110">
                <FileUp className="h-5.5 w-5.5" />
              </span>
              <span className="text-sm font-medium text-gray-700">上传文件</span>
              <span className="px-4 text-center text-xs leading-relaxed text-gray-400">
                支持 PDF / Word 等文档
                <br />
                可多选批量上传
              </span>
            </button>

            <button
              type="button"
              onClick={() => requireProject() && dirInputRef.current?.click()}
              className="group flex h-44 flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-gray-200 bg-[#fafbfc] transition-all hover:border-sky-300 hover:bg-sky-50/40 hover:shadow-sm"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-600 transition-transform group-hover:scale-110">
                <FolderUp className="h-5.5 w-5.5" />
              </span>
              <span className="text-sm font-medium text-gray-700">上传文件夹</span>
              <span className="px-4 text-center text-xs leading-relaxed text-gray-400">
                保留文件夹结构
                <br />
                归档时整体进入项目目录
              </span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <MousePointerClick className="h-3.5 w-3.5" />
            也可以将文件或文件夹直接拖拽到上方区域上传
          </div>
          {!withNamingConfirm && (
            <p className="text-center text-xs text-gray-300">
              文件与文件夹均按所选项目编号，归档至对应的 STUDY TMF 文件夹
            </p>
          )}

          {/* R34 PM 暂存确认流：页面拖拽带入/暂存态选择的文件列表，底部确认后一次性自动命名落库 */}
          {!withNamingConfirm && staged && staged.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">
                待上传（{staged.length} 个文件{stagedRoot ? `，文件夹「${stagedRoot}」` : ''}）
              </h3>
              <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-gray-100 p-3">
                {staged.map((p, i) => (
                  <div key={`${p.relName}-${i}`} className="flex items-center gap-2.5 text-sm">
                    <FileTypeIcon kind="pdf" />
                    <span className="min-w-0 flex-1 truncate text-gray-700" title={p.relName}>
                      {p.relName}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">{fmtSize(p.file.size)}</span>
                    <button
                      type="button"
                      title="移除"
                      onClick={() =>
                        setStaged((prev) => {
                          const next = (prev ?? []).filter((_, j) => j !== i)
                          return next.length > 0 ? next : null
                        })
                      }
                      className="shrink-0 text-gray-300 transition-colors hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">确认后将按命名规则自动命名并上传到「{projectNo}」</p>
            </div>
          )}
        </div>

        {/* R34 PM 暂存确认流底部操作条 */}
        {!withNamingConfirm && staged && staged.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <span className="text-xs text-gray-400">共 {staged.length} 个文件待上传</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => close(false)}>
                取消
              </Button>
              <Button size="sm" className="h-8 bg-teal-500 text-xs text-white hover:bg-teal-600" onClick={confirmStaged}>
                确认上传（{staged.length}）
              </Button>
            </div>
          </div>
        )}

        {/* CRA 确认命名区：已选文件逐行内联——原文件名 + 目标文档下拉 + 新文件名实时预览 */}
        {withNamingConfirm && pending.length > 0 && (
          <div className="space-y-3 px-6 pb-5">
            <h3 className="text-sm font-medium text-gray-700">确认命名（{pending.length} 个文件）</h3>
            <p className="text-xs leading-5 text-gray-400">
              目标文档取自 PM 在「{centerSel} / {projectNo}」SITE TMF 目录下已建的文件夹
              {pmFolders.length === 0 && '（该中心暂未建文件夹，使用标准文档类型）'}
              ；选择后按命名规则自动生成规范文件名，版本号沿用历史版本自动递增。
            </p>
            <div className="max-h-56 overflow-auto rounded-xl border border-gray-100">
              {pending.map((p, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0">
                  <div className="w-44 shrink-0 truncate text-xs text-gray-500" title={p.relName}>
                    {p.relName}
                  </div>
                  <ToolbarSelect
                    value={selections[i] ?? ''}
                    onChange={(v) => setSelections((s) => ({ ...s, [i]: v }))}
                    options={[
                      { label: '请选择目标文档', value: '' },
                      ...docOptions.map((o) => ({ label: o, value: o })),
                    ]}
                    className="w-40 shrink-0 [&>select]:w-full"
                  />
                  <div className={cn('min-w-0 flex-1 text-xs break-all', previews[i] ? 'font-medium text-teal-600' : 'text-gray-300')}>
                    {previews[i]?.name ?? '选择目标文档后预览新文件名'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CRA 底部操作条：只有「取消 / 确认上传」，未全选时确认禁用 */}
        {withNamingConfirm && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <span className={cn('text-xs', allSelected ? 'text-gray-300' : pending.length > 0 ? 'text-amber-500' : 'text-gray-300')}>
              {allSelected ? '已全部选择目标文档' : pending.length > 0 ? '请为每个文件选择目标文档后才能确认上传' : '选择文件后在此逐行确认命名'}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => close(false)}>
                取消
              </Button>
              <Button
                size="sm"
                disabled={!allSelected}
                className="h-8 bg-teal-500 text-xs text-white hover:bg-teal-600 disabled:opacity-40"
                onClick={confirmNaming}
              >
                确认上传
              </Button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            importFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={dirInputRef}
          type="file"
          multiple
          className="hidden"
          {...({ webkitdirectory: 'true' } as Record<string, string>)}
          onChange={(e) => {
            importDir(e.target.files)
            e.target.value = ''
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
