import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronDown, FilePenLine, FileUp, FolderCog, FolderUp, Inbox, Pencil, Plus, Route, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageCard, DataTable, Th, Td, NameTd, NameTh, Tr, FileTypeIcon, TealLink, FavButton, ToolbarSelect } from '@/components/common'
import { VersionHist } from '@/components/VersionHist'
import UploadDialog from '@/components/UploadDialog'
import SmartProcessDialog, { type SmartMode } from '@/components/SmartProcessDialog'
import { ModalHeader } from '@/components/CatalogDialog'
import NamingRuleDialog from '@/components/NamingRuleDialog'
import ConfirmNamingDialog, { type NamingJobItem, type NamingJobResult } from '@/components/ConfirmNamingDialog'
import { analyzeName, autoNameBatch, DOC_TYPE_NAMES, notifyAutoName, TMF_ZONES, UNSORTED_ZONE } from '@/lib/smartDoc'
import { inUnsortedZone, planArchive, planRehome, type ArchivePlan } from '@/lib/archiveRouter'
import { effectiveTemplateRef } from '@/lib/namingSkeleton'
import { LEGACY_NAMING_ENTRY } from '@/lib/featureFlags'
import { readDroppedItems, type DroppedPayload } from '@/lib/dropItems'
import { cn } from '@/lib/utils'
import { useStore, statsByProject, nextId, todayStr, nowStr, fmtSize, displayNameOf, PM_USER, EXECUTOR_CENTER, type TmfFile, type NamingLog } from '@/store'

/* PM Transfer：上传跳过审核可直接归档（归档至对应项目编号的 STUDY TMF 目录）；
   支持新建文件夹 → 命名 → 打开 → 从本地上传文件到文件夹内 */
export default function Transfer() {
  const { state, dispatch } = useStore()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [openFolder, setOpenFolder] = useState<TmfFile | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [smart, setSmart] = useState<{ file: TmfFile; mode: SmartMode } | null>(null)
  /* 删除模式：勾选要删除的行，可取消 */
  const [deleteMode, setDeleteMode] = useState(false)
  const [deleteSel, setDeleteSel] = useState<Set<string>>(new Set())
  /* 文件夹项目编号更换 */
  const [projPicker, setProjPicker] = useState<TmfFile | null>(null)
  const [projDraft, setProjDraft] = useState('')
  /* 归档规则弹窗 + 新增路由表单（CUSTOM_TYPE 表示自定义文档类型） */
  const CUSTOM_TYPE = '__custom__'
  const [rulesOpen, setRulesOpen] = useState(false)
  const [ruleType, setRuleType] = useState<string>(DOC_TYPE_NAMES[0])
  const [ruleCustom, setRuleCustom] = useState('')
  const [ruleZone, setRuleZone] = useState<string>(TMF_ZONES[0])
  /* 命名规则弹窗：打开共享 NamingRuleDialog（组件内自载入当前模板） */
  const [namingOpen, setNamingOpen] = useState(false)
  /* 99 待分拣队列弹窗 */
  const [unsortedOpen, setUnsortedOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  /* R34 上传下拉（上传文件 / 上传文件夹直达 UploadDialog 对应模式）与页面级拖拽带入 */
  const [uploadMenu, setUploadMenu] = useState(false)
  const [uploadPick, setUploadPick] = useState<'files' | 'dir' | null>(null)
  const [uploadPreset, setUploadPreset] = useState<DroppedPayload | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const myFiles = useMemo(() => state.files.filter((f) => f.uploader === PM_USER.name), [state.files])
  /* 全局项目筛选：无本页下拉，静默跟随顶部 Header（'全部' 不过滤） */
  const project = state.activeProject
  const matchProject = (projectNo: string) => project === '全部' || projectNo.startsWith(project)
  /* 项目编号选项：动态取自 STUDY TMF 目录 */
  const projectChoices = useMemo(
    () => [...new Set(state.catalogs.filter((c) => c.kind === 'study').map((c) => c.projectNo))],
    [state.catalogs],
  )
  /* 新建文件夹的默认项目编号：取第一个 STUDY TMF 目录 */
  const defaultProjectNo = projectChoices[0] ?? 'ON101CL103'
  /* 顶层列表：不含文件夹内的子文件，随全局项目筛选 */
  const topFiles = useMemo(
    () => myFiles.filter((f) => f.status !== 'archived' && !f.parentId && matchProject(f.projectNo)),
    [myFiles, project],
  )
  const stats = useMemo(() => statsByProject(myFiles.filter((f) => matchProject(f.projectNo))), [myFiles, project])

  /* 当前文件夹内的子文件 */
  const childFiles = useMemo(
    () => (openFolder ? myFiles.filter((f) => f.parentId === openFolder.id && f.status !== 'archived') : []),
    [myFiles, openFolder],
  )

  /* 收敛C1：归档命中骨架确认制时的待确认任务（plan 已算出，确认后一次性原子落库） */
  const [namingJob, setNamingJob] = useState<{ plan: ArchivePlan; file: TmfFile; items: NamingJobItem[] } | null>(null)

  /* 归档：按「归档规则」把文件路由到该项目 STUDY TMF 的「分区 / 文档类型」文件夹（路由解析与落位见 archiveRouter）；
     未识别文档类型或无匹配路由 → 99 待分拣；文件夹整体归档时子文件各自路由，文件夹本身归入目录根。
     收敛C1：落位目标文件夹已绑定（含继承）启用中骨架的文件，先弹命名确认（与 CRA 同款界面），确认后才落库+审计；
     同批内未绑定骨架的文件不受影响，随同一事务按原路由归档 */
  const archive = (f: TmfFile) => {
    const children =
      f.kind === 'folder' ? myFiles.filter((x) => x.parentId === f.id && x.status !== 'archived') : []
    const plan = planArchive({
      file: f,
      children,
      files: state.files,
      catalogs: state.catalogs,
      routes: state.archiveRoutes,
      uploader: PM_USER.name,
    })
    if (!plan) {
      toast.error('未找到 STUDY TMF 目录', { description: '请先在 STUDY TMF 页创建目录后再归档' })
      return
    }
    /* 按 plan 落位逐文件判定目标文件夹的有效骨架（目录根条目无 parentId，不参与判定）。
       注意：pool 先套用 entries 的归档后 parentId/folderId——文件夹直通时子文件落位父级为传输文件夹，
       其归档后才挂到目标文件夹下，骨架沿归档后链路继承判定才正确 */
    const entryById = new Map(plan.entries.map((e) => [e.id, e]))
    const pool = [...state.files, ...plan.newFolders].map((x) => {
      const e = entryById.get(x.id)
      return e ? { ...x, folderId: e.folderId, parentId: e.parentId } : x
    })
    const byId = new Map(pool.map((x) => [x.id, x]))
    const items: NamingJobItem[] = []
    for (const e of plan.entries) {
      const file = byId.get(e.id)
      if (!file || file.kind === 'folder' || !e.parentId) continue
      const dest = byId.get(e.parentId)
      if (!dest) continue
      const eff = effectiveTemplateRef(pool, dest.id, state.namingTemplates)
      if (eff && eff.template.status === '启用') {
        items.push({
          id: file.id,
          from: file.name,
          projectNo: file.projectNo,
          center: file.center,
          folderId: dest.id,
          folderName: dest.name,
          eff,
        })
      }
    }
    if (items.length > 0) {
      setNamingJob({ plan, file: f, items })
      return
    }
    finishArchive(plan, f)
  }

  /* 旧流程落库：无骨架确认命中时直接 archiveRouted */
  const finishArchive = (plan: ArchivePlan, f: TmfFile) => {
    dispatch({ type: 'archiveRouted', newFolders: plan.newFolders, entries: plan.entries })
    archiveToasts(plan, f)
  }

  /* 归档结果提示（确认制与旧流程共用；extra 追加骨架确认说明） */
  const archiveToasts = (plan: ArchivePlan, f: TmfFile, extra?: string) => {
    const okLines = [...plan.groups.entries()].map(([p, n]) => `已归档至 STUDY TMF / ${p}（${n} 个文件）`)
    /* R27 PM 选定目标文件夹直通：siteGroups 行同样展示（路径形如「研究者简历 / 2 个文件」） */
    okLines.push(...[...plan.siteGroups.entries()].map(([p, n]) => `已归档至 ${p}（${n} 个文件）`))
    if (f.kind === 'folder') okLines.unshift(`文件夹「${f.name}」已归档至 ${f.projectNo} 的 STUDY TMF 文件夹`)
    /* C4：路由来源可追溯——本批有按业务字段路由的文件时附来源行（纯文件名解析批保持旧文案不变） */
    if (plan.routeSources.docType > 0) {
      okLines.push(`路由来源：业务字段 ${plan.routeSources.docType} 个 · 文件名解析 ${plan.routeSources.filenameParse} 个`)
    }
    if (extra) okLines.push(extra)
    if (okLines.length > 0) toast.success('归档成功', { description: okLines.join('；') })
    if (plan.unsorted > 0) {
      toast.warning(`${plan.unsorted} 个文件进入「99 待分拣」`, {
        description: '未识别文档类型或无匹配路由，已归档至 STUDY TMF / 99 待分拣，需人工分拣',
      })
    }
  }

  /* 收敛C1：命名确认回调——命名六字段 + 审计 + 归档路由 原子落库（confirmArchiveNaming） */
  const confirmNaming = (results: NamingJobResult[]) => {
    const job = namingJob
    if (!job) return
    const rById = new Map(results.map((r) => [r.id, r]))
    const time = nowStr()
    const srcOf = (id: string) => state.files.find((x) => x.id === id)
    const patches = job.items.map((it) => {
      const r = rById.get(it.id)!
      const src = srcOf(it.id)
      return {
        id: it.id,
        name: r.finalName,
        displayFilename: r.finalName,
        originalFilename: src?.originalFilename ?? src?.name ?? it.from,
        namingTemplateId: it.eff.template.id,
        versionNo: r.versionNo,
        docStatus: r.docStatus,
        docType: r.docType,
        targetFolderId: it.folderId,
      }
    })
    const logs: NamingLog[] = job.items.map((it) => {
      const r = rById.get(it.id)!
      const src = srcOf(it.id)
      return {
        id: nextId('nl'),
        fileId: it.id,
        operator: PM_USER.name,
        time,
        action: r.action,
        oldValue: r.oldValue,
        newValue: r.finalName,
        projectNo: it.projectNo,
        role: 'pm' as const,
        originalFilename: src?.originalFilename ?? src?.name ?? it.from,
      }
    })
    dispatch({
      type: 'confirmArchiveNaming',
      patches,
      logs,
      newFolders: job.plan.newFolders,
      entries: job.plan.entries,
    })
    archiveToasts(job.plan, job.file, `${job.items.length} 个文件已按骨架确认命名（审计已记录）`)
    setNamingJob(null)
  }

  /* ===== 99 待分拣队列：已归档但处于 99 分区的具体文件（文件夹不计，随全局项目筛选） ===== */
  const fileById = useMemo(() => new Map(state.files.map((f) => [f.id, f])), [state.files])
  const unsortedFiles = useMemo(
    () =>
      state.files.filter(
        (f) =>
          f.kind !== 'folder' &&
          f.status === 'archived' &&
          matchProject(f.projectNo) &&
          inUnsortedZone(f, fileById),
      ),
    [state.files, fileById, project],
  )
  /* 归位弹窗各行分区草稿：默认按该文件 docType 查路由表，查不到默认 01 */
  const [homeZones, setHomeZones] = useState<Record<string, string>>({})
  const defaultZoneOf = (f: TmfFile): string => {
    const a = analyzeName(f.name)
    const r = a.matched ? state.archiveRoutes.find((x) => x.docType === a.docType) : undefined
    return r?.zone ?? TMF_ZONES[0]
  }
  /* 归位：移入 项目 STUDY TMF / 所选分区 / 文档类型文件夹（识别不了直接放分区下），并离开 99 待分拣 */
  const rehome = (f: TmfFile) => {
    const zone = homeZones[f.id] ?? defaultZoneOf(f)
    if (zone === UNSORTED_ZONE) {
      toast.warning('该文件已在「99 待分拣」中，请选择其他分区')
      return
    }
    const plan = planRehome({ file: f, zone, files: state.files, catalogs: state.catalogs, uploader: PM_USER.name })
    if (!plan) {
      toast.error('未找到 STUDY TMF 目录', { description: '请先在 STUDY TMF 页创建目录后再归位' })
      return
    }
    dispatch({ type: 'archiveRouted', newFolders: plan.newFolders, entries: plan.entries })
    setHomeZones((prev) => {
      const next = { ...prev }
      delete next[f.id]
      return next
    })
    const path = [...plan.groups.keys()][0] ?? zone
    toast.success('归位成功', { description: `${f.name} 已归位至 STUDY TMF / ${path}` })
  }

  /* 归档规则：新增一条路由（文档类型下拉含全部标准类型 + 自定义输入） */
  const addRule = () => {
    const docType = ruleType === CUSTOM_TYPE ? ruleCustom.trim() : ruleType
    if (!docType) {
      toast.warning('请输入自定义文档类型名称')
      return
    }
    if (state.archiveRoutes.some((r) => r.docType === docType)) {
      toast.warning(`「${docType}」已存在路由，可直接在列表中修改分区`)
      return
    }
    dispatch({ type: 'addArchiveRoute', route: { id: nextId('ar'), docType, zone: ruleZone } })
    setRuleType(DOC_TYPE_NAMES[0])
    setRuleCustom('')
    setRuleZone(TMF_ZONES[0])
    toast.success(`已添加路由：${docType} → ${ruleZone}`)
  }

  const addFolder = () => {
    const file: TmfFile = {
      id: nextId('f'),
      name: '新建文件夹',
      kind: 'folder',
      projectNo: defaultProjectNo,
      center: EXECUTOR_CENTER,
      uploader: PM_USER.name,
      uploadDate: todayStr(),
      size: '0KB',
      status: 'uploaded',
    }
    dispatch({ type: 'addFiles', files: [file] })
    /* 新建后立即进入命名状态 */
    setRenamingId(file.id)
    setRenameText(file.name)
  }

  const commitRename = () => {
    const name = renameText.trim()
    if (renamingId && name) {
      /* R27 同名冲突提示：同一父级下（同上传人）已有同名文件夹时阻止并保持编辑态 */
      const cur = state.files.find((f) => f.id === renamingId)
      const dup = state.files.some(
        (f) =>
          f.id !== renamingId &&
          f.kind === 'folder' &&
          f.parentId === cur?.parentId &&
          f.uploader === cur?.uploader &&
          f.name === name,
      )
      if (dup) {
        toast.warning('已存在同名文件夹', { description: '同一位置下文件夹名称不能重复，请换一个名称' })
        return
      }
      dispatch({ type: 'renameFile', id: renamingId, name })
    }
    setRenamingId(null)
  }

  /* 删除模式：进入/勾选/取消/确认删除（文件夹子文件级联删除） */
  const enterDelete = () => {
    setDeleteMode(true)
    setDeleteSel(new Set())
  }
  const exitDelete = () => {
    setDeleteMode(false)
    setDeleteSel(new Set())
  }
  const toggleDel = (id: string, checked: boolean) => {
    setDeleteSel((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }
  const confirmDelete = () => {
    if (deleteSel.size === 0) {
      toast.warning('请先勾选要删除的文件/文件夹')
      return
    }
    const n = deleteSel.size
    dispatch({ type: 'removeFiles', ids: [...deleteSel] })
    toast.success(`已删除 ${n} 项`, { description: '如包含文件夹，其内子文件已一并删除' })
    exitDelete()
  }

  /* 删除模式作用列表：文件夹钻取视图内为子文件，否则为顶层列表 */
  const currentList = openFolder ? childFiles : topFiles
  const toggleSelectAll = () =>
    setDeleteSel((prev) =>
      prev.size === currentList.length && currentList.length > 0
        ? new Set()
        : new Set(currentList.map((f) => f.id)),
    )

  /* 文件夹更换项目编号（级联子文件） */
  const openProjPicker = (f: TmfFile) => {
    setProjPicker(f)
    setProjDraft(f.projectNo)
  }
  const confirmProjChange = () => {
    if (!projPicker || !projDraft) return
    dispatch({ type: 'setFileProject', id: projPicker.id, projectNo: projDraft })
    toast.success('项目编号已更新', {
      description: `文件夹「${projPicker.name}」及子文件的编号已更新为 ${projDraft}，归档时将进入该项目 STUDY TMF`,
    })
    setProjPicker(null)
  }

  /* 从本地电脑上传文件到当前文件夹（继承文件夹的项目编号，归档时跟随）；上传即自动命名——
     命中词典按「命名规则」模板渲染（未命中保留原名），同文档新版本自动递增并关联历史版本（版本链）。
     R34：接受 File[]（页面拖拽）或 FileList（隐藏 input） */
  const importLocal = (input: FileList | File[] | null) => {
    const arr = input ? Array.from(input) : []
    if (arr.length === 0 || !openFolder) return
    const results = autoNameBatch(
      arr.map((fl) => fl.name.replace(/\.[^.]+$/, '')),
      state.files.map((f) => f.name),
      {
        files: state.files,
        projectNo: openFolder.projectNo,
        center: openFolder.center,
        template: state.namingTemplate,
        today: todayStr(),
      },
    )
    const files: TmfFile[] = arr.map((fl, i) => ({
      id: nextId('f'),
      name: results[i].name,
      kind: 'pdf' as const,
      projectNo: openFolder.projectNo,
      center: openFolder.center,
      uploader: PM_USER.name,
      uploadDate: todayStr(),
      size: fmtSize(fl.size),
      status: 'uploaded' as const,
      parentId: openFolder.id,
      ...(results[i].versionOf ? { versionOf: results[i].versionOf } : {}),
    }))
    dispatch({ type: 'addFiles', files })
    notifyAutoName({
      title: `已上传 ${files.length} 个文件至「${openFolder.name}」`,
      renamed: results.filter((r) => r.renamed).map((r) => `${r.from} → ${r.name}`),
      unmatched: results.filter((r) => !r.matched).length,
      extra: `项目编号：${openFolder.projectNo}`,
      versionNotes: results
        .filter((r) => r.prevVersion)
        .map((r) => `检测到历史版本 ${r.prevVersion}，已命名为 ${r.name} 并关联历史版本`),
    })
  }

  /* 文件名称单元格：文件夹可点击打开 / 重命名态显示输入框 */
  const nameCell = (f: TmfFile) => {
    if (renamingId === f.id) {
      return (
        <input
          autoFocus
          value={renameText}
          onChange={(e) => setRenameText(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setRenamingId(null)
          }}
          className="w-48 rounded-md border border-teal-300 px-2 py-1 text-center text-sm text-gray-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
      )
    }
    return (
      <span className="flex min-w-0 items-center justify-center gap-2.5">
        <FileTypeIcon kind={f.kind} />
        {f.kind === 'folder' ? (
          <button
            type="button"
            onClick={() => (deleteMode ? toggleDel(f.id, !deleteSel.has(f.id)) : setOpenFolder(f))}
            title={deleteMode ? '点击勾选/取消' : '点击打开文件夹'}
            className="truncate text-gray-700 underline decoration-teal-300 decoration-dotted underline-offset-4 transition-colors hover:text-teal-600"
          >
            {f.name}
          </button>
        ) : (
          <span className="truncate text-gray-700">{f.name}</span>
        )}
        <VersionHist file={f} />
        {f.kind === 'folder' && (
          <button
            type="button"
            title="重命名"
            onClick={() => {
              setRenamingId(f.id)
              setRenameText(f.name)
            }}
            className="shrink-0 text-gray-300 transition-colors hover:text-teal-500"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    )
  }

  /* 文件与文件夹均可归档：按归档规则自动路由到 STUDY TMF 分区；文件夹子文件各自路由 */
  const statusCell = (f: TmfFile) => (
    <button
      type="button"
      onClick={() => archive(f)}
      title={
        f.kind === 'folder'
          ? `文件夹整体归档：子文件按归档规则各自路由至 ${f.projectNo} 的 STUDY TMF 分区`
          : `按归档规则归档至 ${f.projectNo} 的 STUDY TMF 对应分区`
      }
      className="inline-flex items-center rounded-md bg-teal-500 px-3 py-1.5 text-xs text-white transition-colors hover:bg-teal-600"
    >
      归档
    </button>
  )

  /* 项目编号徽标：醒目标示归档归属；文件夹可点击更换编号 */
  const projectCell = (f: TmfFile) =>
    f.kind === 'folder' ? (
      <button
        type="button"
        title="点击更换项目编号"
        onClick={() => openProjPicker(f)}
        className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-100 transition-colors hover:bg-teal-100"
      >
        {f.projectNo}
        <FolderCog className="h-3 w-3 text-teal-400" />
      </button>
    ) : (
      <span className="inline-flex rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-100">
        {f.projectNo}
      </span>
    )

  const fileTable = (rows: TmfFile[]) => (
    <DataTable>
      <thead>
        <tr>
          {deleteMode && <Th sortable={false} className="w-12">选择</Th>}
          <NameTh className="w-[26%]">文件名称</NameTh>
          <Th className="w-36">上传日期</Th>
          <Th className="w-28">文件大小</Th>
          <Th className="w-40">项目编号</Th>
          <Th sortable={false} className="w-52">智能处理</Th>
          <Th sortable={false} className="w-28">状态</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((f) => (
          <Tr key={f.id}>
            {deleteMode && (
              <Td>
                <input
                  type="checkbox"
                  checked={deleteSel.has(f.id)}
                  onChange={(e) => toggleDel(f.id, e.target.checked)}
                  className="h-4 w-4 accent-teal-600"
                />
              </Td>
            )}
            <NameTd aside={f.kind !== 'folder' ? <FavButton id={f.id} /> : undefined}>{nameCell(f)}</NameTd>
            <Td>{f.uploadDate}</Td>
            <Td>{f.size}</Td>
            <Td>{projectCell(f)}</Td>
            <Td>
              {f.kind === 'folder' || !LEGACY_NAMING_ENTRY ? (
                <span className="text-xs text-gray-300">—</span>
              ) : (
                /* C2：旧命名入口默认隐藏（LEGACY_NAMING_ENTRY=true 可回退） */
                <span className="flex items-center gap-4">
                  <TealLink onClick={() => setSmart({ file: f, mode: 'rename' })}>智能命名</TealLink>
                  <TealLink onClick={() => setSmart({ file: f, mode: 'correct' })}>智能纠错</TealLink>
                </span>
              )}
            </Td>
            <Td>{statusCell(f)}</Td>
          </Tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={deleteMode ? 7 : 6} className="py-12 text-center text-sm text-gray-400">
              {openFolder ? '文件夹内暂无文件，点击右上角"上传"从本地导入' : '暂无文件，点击右上角"上传"添加文件'}
            </td>
          </tr>
        )}
      </tbody>
    </DataTable>
  )

  return (
    <div className="space-y-5">
      <PageCard title="文件状态">
        <DataTable>
          <thead>
            <tr>
              <Th sortable={false}>项目编号</Th>
              <Th sortable={false}>已上传</Th>
              <Th sortable={false}>归档</Th>
            </tr>
          </thead>
          <tbody>
            {stats.map((r) => (
              <Tr key={r.project}>
                <Td>{r.project}</Td>
                <Td>{r.uploaded}</Td>
                <Td>{r.archived}</Td>
              </Tr>
            ))}
            {stats.length === 0 && (
              <tr>
                <td colSpan={3} className="py-10 text-center text-sm text-gray-400">
                  暂无传输数据
                </td>
              </tr>
            )}
          </tbody>
        </DataTable>
      </PageCard>

      {/* R34 页面级拖拽：本地文件/文件夹拖到文件上传列表区域——文件夹钻取视图内直接入当前文件夹（自动命名），
          顶层列表则打开上传弹窗进入暂存确认流（预选文件已带入） */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void (async () => {
            const payload = await readDroppedItems(e.dataTransfer)
            if (payload.items.length === 0) return
            if (openFolder) {
              importLocal(payload.items.map((p) => p.file))
              return
            }
            setUploadPick(null)
            setUploadPreset(payload)
            setUploadOpen(true)
          })()
        }}
        className={cn('rounded-2xl transition-all', dragOver && 'bg-teal-50/40 ring-2 ring-teal-300 ring-offset-2')}
      >
      <PageCard
        title={
          openFolder ? (
            <span className="flex items-center gap-2 text-[15px] font-semibold text-gray-800">
              <button
                type="button"
                onClick={() => {
                  exitDelete()
                  setOpenFolder(null)
                }}
                className="flex items-center gap-1 text-sm font-normal text-gray-400 transition-colors hover:text-teal-600"
              >
                <ArrowLeft className="h-4 w-4" /> 返回
              </button>
              <span className="text-gray-300">|</span>
              文件上传 / {openFolder.name}
            </span>
          ) : (
            '文件上传'
          )
        }
        extra={
          <div className="flex items-center gap-2">
            {deleteMode ? (
              <>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={toggleSelectAll}>
                  {deleteSel.size === currentList.length && currentList.length > 0 ? '清空' : '全选'}
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exitDelete}>
                  取消
                </Button>
                <Button
                  size="sm"
                  className="h-8 gap-1 bg-red-500 text-xs text-white hover:bg-red-600"
                  onClick={confirmDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" /> 确认删除{deleteSel.size > 0 ? `（${deleteSel.size}）` : ''}
                </Button>
              </>
            ) : openFolder ? (
              <>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={enterDelete}>
                  <Trash2 className="h-3.5 w-3.5" /> 删除
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> 上传
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setRulesOpen(true)}>
                  <Route className="h-3.5 w-3.5" /> 归档规则
                </Button>
                {/* 命名规则：CRA 上传确认命名与 PM 上传自动命名共用的文件名模板；
                    C2：旧命名入口默认隐藏（LEGACY_NAMING_ENTRY=true 可回退），NamingRuleDialog 组件保留 */}
                {LEGACY_NAMING_ENTRY && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => setNamingOpen(true)}
                  >
                    <FilePenLine className="h-3.5 w-3.5" /> 命名规则
                  </Button>
                )}
                {/* 99 待分拣队列：琥珀色徽标计数（为 0 时隐藏徽标，按钮仍可见） */}
                <Button
                  variant="outline"
                  size="sm"
                  className="relative h-8 gap-1 text-xs"
                  onClick={() => setUnsortedOpen(true)}
                >
                  <Inbox className="h-3.5 w-3.5" /> 待分拣
                  {unsortedFiles.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-medium text-white">
                      {unsortedFiles.length}
                    </span>
                  )}
                </Button>
                {/* R34：只建空文件夹（建完行内命名） */}
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addFolder}>
                  <Plus className="h-3.5 w-3.5" /> 新建文件夹
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={enterDelete}>
                  <Trash2 className="h-3.5 w-3.5" /> 删除
                </Button>
                {/* R34：上传改下拉按钮——上传文件 / 上传文件夹直达 UploadDialog 对应模式 */}
                <span className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => setUploadMenu((v) => !v)}
                  >
                    <Upload className="h-3.5 w-3.5" /> 上传 <ChevronDown className="h-3 w-3" />
                  </Button>
                  {uploadMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setUploadMenu(false)} />
                      <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-gray-100 bg-white p-1 shadow-lg">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-gray-600 transition-colors hover:bg-teal-50 hover:text-teal-700"
                          onClick={() => {
                            setUploadMenu(false)
                            setUploadPreset(null)
                            setUploadPick('files')
                            setUploadOpen(true)
                          }}
                        >
                          <FileUp className="h-3.5 w-3.5 text-teal-500" /> 上传文件
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-gray-600 transition-colors hover:bg-sky-50 hover:text-sky-700"
                          onClick={() => {
                            setUploadMenu(false)
                            setUploadPreset(null)
                            setUploadPick('dir')
                            setUploadOpen(true)
                          }}
                        >
                          <FolderUp className="h-3.5 w-3.5 text-sky-500" /> 上传文件夹
                        </button>
                      </div>
                    </>
                  )}
                </span>
              </>
            )}
          </div>
        }
      >
        {openFolder ? fileTable(childFiles) : fileTable(topFiles)}
      </PageCard>
      </div>

      {/* 文件夹内上传：来源为个人电脑本地文件 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          importLocal(e.target.files)
          e.target.value = ''
        }}
      />

      <UploadDialog
        open={uploadOpen}
        onOpenChange={(o) => {
          setUploadOpen(o)
          if (!o) {
            setUploadPick(null)
            setUploadPreset(null)
          }
        }}
        uploader={PM_USER.name}
        autoPick={uploadPick}
        preset={uploadPreset}
      />
      {/* C2：旧智能命名/纠错弹窗默认不挂载（LEGACY_NAMING_ENTRY=true 可回退） */}
      {LEGACY_NAMING_ENTRY && <SmartProcessDialog target={smart} onClose={() => setSmart(null)} />}

      {/* 99 待分拣队列弹窗：逐文件选择分区归位，全部归位完自动刷新计数 */}
      <Dialog open={unsortedOpen} onOpenChange={setUnsortedOpen}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">待分拣文件</DialogTitle>
          <ModalHeader title="待分拣文件" onClose={() => setUnsortedOpen(false)} />
          <div className="max-h-[calc(85vh-52px)] overflow-y-auto p-5">
            <p className="mb-4 text-xs leading-5 text-gray-400">
              以下文件归档时未识别出文档类型或无匹配路由，暂存于「99 待分拣」；选择目标分区后点击「归位」即可移入
              STUDY TMF 对应分区。
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-100 p-4 shadow-sm">
              <DataTable>
                <thead>
                  <tr>
                    <NameTh>文件名称</NameTh>
                    <Th sortable={false} className="w-36">项目编号</Th>
                    <Th sortable={false} className="w-72">归位操作</Th>
                  </tr>
                </thead>
                <tbody>
                  {unsortedFiles.map((f) => (
                    <Tr key={f.id}>
                      <NameTd>
                        <span className="flex min-w-0 items-center gap-2.5">
                          <FileTypeIcon kind={f.kind} />
                          <span className="truncate text-gray-700">{f.name}</span>
                        </span>
                      </NameTd>
                      <Td>{f.projectNo}</Td>
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          <ToolbarSelect
                            value={homeZones[f.id] ?? defaultZoneOf(f)}
                            onChange={(v) => setHomeZones((prev) => ({ ...prev, [f.id]: v }))}
                            options={[...TMF_ZONES]}
                          />
                          <Button
                            size="sm"
                            className="h-8 bg-teal-600 text-xs text-white hover:bg-teal-700"
                            onClick={() => rehome(f)}
                          >
                            归位
                          </Button>
                        </span>
                      </Td>
                    </Tr>
                  ))}
                  {unsortedFiles.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-sm text-gray-400">
                        没有待分拣的文件
                      </td>
                    </tr>
                  )}
                </tbody>
              </DataTable>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 命名规则配置弹窗：抽取为共享组件 NamingRuleDialog（目录创建弹窗「命名设置」同款）；
          C2：TRANSFER 入口已隐藏，挂载点同步隔离（LEGACY_NAMING_ENTRY=true 可回退） */}
      {LEGACY_NAMING_ENTRY && <NamingRuleDialog open={namingOpen} onOpenChange={setNamingOpen} />}

      {/* 收敛C1：归档命名确认弹窗——目标文件夹绑骨架时逐行确认命名（takenNames=目标文件夹内已归档展示名，排除本批自身） */}
      <ConfirmNamingDialog
        open={!!namingJob}
        onOpenChange={(o) => !o && setNamingJob(null)}
        title="归档命名确认"
        confirmLabel="确认归档"
        items={namingJob?.items ?? []}
        takenNames={(fid) =>
          state.files
            .filter(
              (f) =>
                f.status === 'archived' &&
                (f.parentId === fid || f.targetFolderId === fid) &&
                !namingJob?.items.some((it) => it.id === f.id),
            )
            .map(displayNameOf)
        }
        onConfirm={confirmNaming}
      />

      {/* 归档规则配置弹窗：文档类型 → STUDY TMF 分区 路由表（默认路由同样可编辑/删除） */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-2xl">
          <DialogTitle className="sr-only">归档规则</DialogTitle>
          <ModalHeader title="归档规则" onClose={() => setRulesOpen(false)} />
          <div className="max-h-[calc(85vh-52px)] overflow-y-auto p-5">
            <p className="mb-4 text-xs leading-5 text-gray-400">
              归档时按文件名识别文档类型，自动归入对应项目 STUDY TMF 的「分区 / 文档类型」文件夹；
              未识别或无匹配路由的文件进入「99 待分拣」，需人工分拣。
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-100 p-4 shadow-sm">
              <DataTable>
                <thead>
                  <tr>
                    <Th sortable={false}>文档类型</Th>
                    <Th sortable={false} className="w-48">归档分区</Th>
                    <Th sortable={false} className="w-20">操作</Th>
                  </tr>
                </thead>
                <tbody>
                  {state.archiveRoutes.map((r) => (
                    <Tr key={r.id}>
                      <Td>{r.docType}</Td>
                      <Td>
                        <ToolbarSelect
                          value={r.zone}
                          onChange={(v) => dispatch({ type: 'updateArchiveRoute', id: r.id, patch: { zone: v } })}
                          options={[...TMF_ZONES]}
                        />
                      </Td>
                      <Td>
                        <button
                          type="button"
                          title="删除该路由"
                          onClick={() => dispatch({ type: 'removeArchiveRoute', id: r.id })}
                          className="text-gray-300 transition-colors hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </Td>
                    </Tr>
                  ))}
                  {/* 新增路由：文档类型下拉（全部标准类型 + 自定义输入）+ 分区下拉 */}
                  <Tr>
                    <Td>
                      <span className="inline-flex items-center gap-2">
                        <ToolbarSelect
                          value={ruleType}
                          onChange={setRuleType}
                          options={[
                            ...DOC_TYPE_NAMES.map((t) => ({ label: t, value: t })),
                            { label: '自定义…', value: CUSTOM_TYPE },
                          ]}
                        />
                        {ruleType === CUSTOM_TYPE && (
                          <input
                            value={ruleCustom}
                            onChange={(e) => setRuleCustom(e.target.value)}
                            placeholder="输入类型名称"
                            className="w-32 rounded-md border border-teal-300 px-2 py-1 text-center text-sm outline-none focus:border-teal-500"
                          />
                        )}
                      </span>
                    </Td>
                    <Td>
                      <ToolbarSelect value={ruleZone} onChange={setRuleZone} options={[...TMF_ZONES]} />
                    </Td>
                    <Td>
                      <Button
                        size="sm"
                        className="h-8 gap-1 bg-teal-600 text-xs text-white hover:bg-teal-700"
                        onClick={addRule}
                      >
                        <Plus className="h-3.5 w-3.5" /> 添加
                      </Button>
                    </Td>
                  </Tr>
                </tbody>
              </DataTable>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 文件夹项目编号更换弹窗 */}
      <Dialog open={!!projPicker} onOpenChange={(o) => !o && setProjPicker(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[15px]">
              <FolderCog className="h-4 w-4 text-teal-600" /> 更换项目编号
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
              {projPicker && <FileTypeIcon kind={projPicker.kind} />}
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-700">{projPicker?.name}</p>
                <p className="text-xs text-gray-400">当前编号：{projPicker?.projectNo}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">归属项目编号（归档目标 STUDY TMF）</label>
              <ToolbarSelect
                value={projDraft}
                onChange={setProjDraft}
                options={projectChoices.map((p) => ({ label: p, value: p }))}
                className="w-full [&>select]:w-full"
              />
              <p className="text-xs text-gray-400">更换后文件夹内子文件的编号将同步更新</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setProjPicker(null)}>
                取消
              </Button>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={confirmProjChange}>
                确认更换
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
