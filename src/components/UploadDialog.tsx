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
import {
  effectiveTemplateRef,
  renderSkeleton,
  appendDupSuffix,
  VERSION_OPTIONS,
  DOC_STATUS_OPTIONS,
} from '@/lib/namingSkeleton'
import { useStore, nextId, todayStr, nowStr, fmtSize, displayNameOf, EXECUTOR_NAME, EXECUTOR_CENTER, type TmfFile, type NamingTemplate, type NamingLog } from '@/store'

const FALLBACK_PROJECTS = ['ON101CL01', 'ON101CL103', 'ON101CLCT01']

/** 待确认命名的文件项：file 为原始 File，relName 用于识别分析（文件夹上传时为文件夹内相对路径） */
interface PendingItem {
  file: File
  relName: string
}

/** R39 命名向导行状态（模式A：目录绑定命名范式）：docType 存字典 code（{文件类型简称} 取值）；
    override/dirty 为 CRA 手动覆盖预览名（PRD：允许手动修改，但必须确认，不静默重命名）；
    touched=该行任一字段被手动微调过（二阶段A 批量「应用到全部」跳过 touched 行）；
    aiFilled=AI 语义预填命中文档类型（二阶段B：仅预填下拉不落名，手动改动即清除徽标） */
interface WizRow {
  docType: string
  versionNo: string
  docStatus: string
  override: string
  dirty: boolean
  touched: boolean
  aiFilled: boolean
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
  /* R39 命名向导：每行命中「绑定骨架」目标文档时的向导字段（随 selections 同步初始化/清理） */
  const [wiz, setWiz] = useState<Record<number, WizRow>>({})
  /* R39 二阶段A 批量：顶部「应用到全部」操作条取值（类型/版本/状态；空项不套用） */
  const [bulk, setBulk] = useState({ docType: '', versionNo: '', docStatus: '' })
  /* 批量时未绑定骨架行的可编辑名称（单行未绑定仍走旧模板只读预览） */
  const [freeNames, setFreeNames] = useState<Record<number, string>>({})
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

  /* ---------- R39 命名向导（模式A：目录绑定命名范式） ---------- */
  /* 该行目标文档是否命中「绑定骨架」：目标为真实 PM 文件夹且其自身/上级继承绑定了启用中骨架 */
  const boundRef = (i: number) => {
    const sel = selections[i]
    if (!sel) return null
    const folder = pmFolderMap.get(sel)
    if (!folder) return null
    const eff = effectiveTemplateRef(state.files, folder.id, state.namingTemplates)
    if (!eff || eff.template.status !== '启用') return null
    return { folder, eff }
  }
  /* 类型下拉选项：骨架 docTypeFilter 限定时只列限定类型，否则全字典 */
  const docTypeChoicesFor = (tpl: NamingTemplate) => {
    const filter = tpl.docTypeFilter
    return filter && filter.length > 0 ? state.docTypes.filter((d) => filter.includes(d.id)) : state.docTypes
  }
  /* 手动微调：置 touched（批量套用跳过）并清除 AI 预填徽标（值已非 AI 预选） */
  const patchWiz = (i: number, patch: Partial<WizRow>) =>
    setWiz((s) => (s[i] ? { ...s, [i]: { ...s[i], ...patch, touched: true, aiFilled: false } } : s))
  /* 向导行骨架实时渲染：试验编号/中心/日期自动带入；SAE序号、访视编号留空（renderSkeleton 整段剔除） */
  const wizRender = (tpl: NamingTemplate, w: WizRow) =>
    renderSkeleton(tpl.skeleton, {
      试验编号: projectNo,
      中心编号: centerSel,
      YYYYMMDD: todayStr().replaceAll('-', ''),
      文件类型简称: w.docType,
      版本号: w.versionNo,
      文档状态: w.docStatus,
      SAE序号: '',
      访视编号: '',
    })
  /* 目标文件夹内现存展示名（重名检测用） */
  const folderChildNames = (folderId: string) =>
    state.files.filter((f) => f.parentId === folderId || f.targetFolderId === folderId).map(displayNameOf)

  /* ---------- R39 二阶段A：批量「应用到全部」 ---------- */
  /* 命中绑定骨架的向导行下标 */
  const boundRowIdxs = pending.map((_, i) => i).filter((i) => !!boundRef(i) && !!wiz[i])
  /* 操作条类型选项 = 各绑定行骨架限定类型的并集（按 code 去重） */
  const bulkTypeOptions = useMemo(() => {
    const map = new Map<string, string>()
    pending.forEach((_, i) => {
      const b = boundRef(i)
      if (!b) return
      for (const d of docTypeChoicesFor(b.eff.template)) if (!map.has(d.code)) map.set(d.code, d.name)
    })
    return [...map.entries()].map(([code, name]) => ({ label: `${code}｜${name}`, value: code }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, selections, pmFolderMap, state.files, state.namingTemplates, state.docTypes])
  /* 一键套用：仅覆盖未手动微调（touched=false）的向导行；docType 仅在行骨架限定类型包含时套用，
     已微调行保持不动并在 toast 报数 */
  const applyBulk = () => {
    if (!bulk.docType && !bulk.versionNo && !bulk.docStatus) {
      toast.warning('请先选择要套用的类型 / 版本 / 状态')
      return
    }
    let applied = 0
    let skippedTouched = 0
    let skippedType = 0
    setWiz((s) => {
      const next = { ...s }
      for (const i of boundRowIdxs) {
        const row = next[i]
        const b = boundRef(i)
        if (!row || !b) continue
        if (row.touched) {
          skippedTouched++
          continue
        }
        let dt = row.docType
        if (bulk.docType) {
          if (docTypeChoicesFor(b.eff.template).some((d) => d.code === bulk.docType)) dt = bulk.docType
          else skippedType++
        }
        next[i] = { ...row, docType: dt, versionNo: bulk.versionNo || row.versionNo, docStatus: bulk.docStatus || row.docStatus, aiFilled: dt === row.docType ? row.aiFilled : false }
        applied++
      }
      return next
    })
    toast.success(`已套用到 ${applied} 行`, {
        description: [
          skippedTouched > 0 ? `${skippedTouched} 行已手动微调，保持不动` : '',
          skippedType > 0 ? `${skippedType} 行的骨架限定类型不含所选类型，类型未套用` : '',
        ]
          .filter(Boolean)
          .join('；') || undefined,
      })
  }
  /* selections 变化 → 命中绑定的行初始化向导（类型预选沿用 analyzeName 识别），未命中行清理向导 */
  useEffect(() => {
    if (!withNamingConfirm) return
    setWiz((prev) => {
      const next: Record<number, WizRow> = {}
      let changed = false
      pending.forEach((p, i) => {
        const sel = selections[i]
        const folder = sel ? pmFolderMap.get(sel) : undefined
        const eff = folder ? effectiveTemplateRef(state.files, folder.id, state.namingTemplates) : null
        if (!eff || eff.template.status !== '启用') {
          if (prev[i]) changed = true
          return
        }
        if (prev[i]) {
          next[i] = prev[i]
          return
        }
        changed = true
        const a = analyzeName(p.relName)
        const choices = docTypeChoicesFor(eff.template)
        /* R39 二阶段B：AI 语义预填开关（admin NAMING 页维护，默认关）——开启时才按原文件名关键词
           从骨架限定类型中预选（仅预填下拉并显示徽标，绝不落地文件名）；关闭则不预选 */
        const hit =
          state.aiPrefill && a.matched
            ? choices.find((d) => d.code.includes(a.docType) || a.docType.includes(d.code) || d.name.includes(a.docType))
            : undefined
        next[i] = { docType: hit?.code ?? '', versionNo: '1.0', docStatus: '草稿', override: '', dirty: false, touched: false, aiFilled: !!hit }
      })
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withNamingConfirm, pending, selections, pmFolderMap, state.namingTemplates, state.docTypes, state.aiPrefill])

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
    setWiz({})
    setBulk({ docType: '', versionNo: '', docStatus: '' })
    setFreeNames({})
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

  /* R39：向导行（命中绑定骨架）除目标文档外还必须选择文档类型 */
  const allSelected =
    pending.length > 0 &&
    pending.every((_, i) => {
      if (!selections[i]) return false
      if (boundRef(i) && !wiz[i]?.docType) return false
      return true
    })

  /* 确认上传：按模板渲染结果落库（版本链关联历史版本），文件夹上传时文件夹名不变、子文件挂为其子级；
     目标文档对应真实 PM 文件夹时写入 targetFolderId（审核通过后直接归档进该文件夹）。
     R39 向导行：按绑定骨架渲染最终名（允许 CRA 手动覆盖），重名自动追加（2）（3）…；
     落库写 originalFilename（永不可改）/displayFilename/namingTemplateId/业务字段，并追加 NamingLog 审计 */
  const confirmNaming = () => {
    if (!allSelected) {
      toast.warning('请完成每个文件的命名确认', { description: '未选择目标文档、或向导行未选择文档类型的文件无法按规则命名' })
      return
    }
    const folderId = dirRoot ? nextId('f') : undefined
    /* 目标文件夹 → 现存展示名集合（含本批已确定名），供重名追加（2）（3） */
    const takenByFolder = new Map<string, Set<string>>()
    const takenOf = (fid: string) => {
      let s = takenByFolder.get(fid)
      if (!s) {
        s = new Set(folderChildNames(fid))
        takenByFolder.set(fid, s)
      }
      return s
    }
    const namingLogs: NamingLog[] = []
    const suffixedNotes: string[] = []
    const finalNames: string[] = []
    const files: TmfFile[] = pending.map((p, i) => {
      const target = pmFolderMap.get(selections[i])
      const id = nextId('f')
      const b = boundRef(i)
      const w = wiz[i]
      if (b && w) {
        /* 向导行：骨架渲染（或手动覆盖）→ 目标文件夹内重名自动追加序号 */
        const rendered = wizRender(b.eff.template, w)
        const want = ((w.dirty ? w.override.trim() : rendered) || rendered || p.relName).trim()
        const finalName = appendDupSuffix(want, takenOf(b.folder.id))
        if (finalName !== want) suffixedNotes.push(`目标文件夹内已存在同名文件，已自动命名为 ${finalName}`)
        takenOf(b.folder.id).add(finalName)
        finalNames.push(finalName)
        namingLogs.push({
          id: nextId('nl'),
          fileId: id,
          operator: uploader,
          time: nowStr(),
          /* 重名被追加序号时单独记「重名追加」动作：oldValue=期望名、newValue=实际名 */
          action: finalName !== want ? '重名追加' : '创建命名',
          oldValue: finalName !== want ? want : '',
          newValue: finalName,
          projectNo,
          role: 'executor',
          originalFilename: p.file.name,
        })
        return {
          id,
          name: finalName,
          displayFilename: finalName,
          originalFilename: p.file.name,
          namingTemplateId: b.eff.template.id,
          versionNo: w.versionNo,
          docStatus: w.docStatus,
          docType: w.docType,
          kind: 'pdf' as const,
          ...baseFields(),
          size: fmtSize(p.file.size),
          ...(folderId ?? fixedParentId ? { parentId: (folderId ?? fixedParentId) as string } : {}),
          targetFolderId: b.folder.id,
        }
      }
      /* 未绑定行：批量时 CRA 可手改名称（freeNames 优先），否则沿用旧模板预览 */
      const freeName = freeNames[i]?.trim()
      const unboundName = freeName || (previews[i]?.name ?? p.relName)
      finalNames.push(unboundName)
      return {
        id,
        name: unboundName,
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
    if (namingLogs.length > 0) dispatch({ type: 'addNamingLogs', logs: namingLogs })
    notifyAutoName({
      title: dirRoot ? `已上传文件夹「${dirRoot}」（${files.length} 个文件）` : `已上传 ${files.length} 个文件`,
      renamed: pending.map((p, i) => `${p.relName} → ${finalNames[i]}`),
      unmatched: 0,
      extra: `项目编号：${projectNo}，已按命名规则生成规范文件名`,
      versionNotes: [
        ...previews
          .map((pv) => (pv?.chain.prevVersion ? `检测到历史版本 ${pv.chain.prevVersion}，已命名为 ${pv.name} 并关联历史版本` : ''))
          .filter((s): s is string => !!s),
        ...suffixedNotes,
      ],
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
            {/* R39 二阶段A 批量操作条：多文件且有绑定骨架行时，一键套用类型/版本/状态到未手动微调的行 */}
            {pending.length >= 2 && boundRowIdxs.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5 ring-1 ring-gray-100">
                <span className="text-xs font-medium whitespace-nowrap text-gray-500">应用到全部：</span>
                <ToolbarSelect
                  value={bulk.docType}
                  onChange={(v) => setBulk((b) => ({ ...b, docType: v }))}
                  options={[{ label: '类型（不套用）', value: '' }, ...bulkTypeOptions]}
                  className="w-44 [&>select]:w-full"
                />
                <ToolbarSelect
                  value={bulk.versionNo}
                  onChange={(v) => setBulk((b) => ({ ...b, versionNo: v }))}
                  options={[{ label: '版本（不套用）', value: '' }, ...VERSION_OPTIONS.map((v) => ({ label: `V${v}`, value: v }))]}
                  className="w-28 [&>select]:w-full"
                />
                <ToolbarSelect
                  value={bulk.docStatus}
                  onChange={(v) => setBulk((b) => ({ ...b, docStatus: v }))}
                  options={[{ label: '状态（不套用）', value: '' }, ...DOC_STATUS_OPTIONS.map((s) => ({ label: s, value: s }))]}
                  className="w-28 [&>select]:w-full"
                />
                <Button size="sm" className="h-7 bg-teal-500 px-3 text-xs text-white hover:bg-teal-600" onClick={applyBulk}>
                  套用
                </Button>
                <span className="text-[11px] text-gray-400">仅套用绑定骨架的行；已手动微调的行保持不动</span>
              </div>
            )}
            <div className="max-h-80 overflow-auto rounded-xl border border-gray-100">
              {pending.map((p, i) => {
                const b = boundRef(i)
                const w = wiz[i]
                return (
                  <div key={i} className="border-b border-gray-50 px-4 py-3 last:border-0">
                    <div className="flex items-center gap-3">
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
                      {b ? (
                        <span
                          title={b.eff.inherited ? `骨架继承自目录：${b.eff.holder.name}` : '该目录已绑定命名骨架'}
                          className="ml-auto shrink-0 cursor-help rounded-full bg-teal-50 px-2 py-0.5 text-[11px] whitespace-nowrap text-teal-600 ring-1 ring-teal-100"
                        >
                          骨架·{b.eff.template.name}
                          {b.eff.inherited ? '（继承）' : ''}
                        </span>
                      ) : pending.length >= 2 ? (
                        /* 批量 + 未绑定骨架：该行名称可手动编辑（默认带入旧模板预览值） */
                        <input
                          value={freeNames[i] ?? previews[i]?.name ?? ''}
                          onChange={(e) => setFreeNames((s) => ({ ...s, [i]: e.target.value }))}
                          placeholder="选择目标文档后生成预览，可手动修改"
                          className="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                        />
                      ) : (
                        <div className={cn('min-w-0 flex-1 text-xs break-all', previews[i] ? 'font-medium text-teal-600' : 'text-gray-300')}>
                          {previews[i]?.name ?? '选择目标文档后预览新文件名'}
                        </div>
                      )}
                    </div>
                    {/* R39 命名向导区：命中绑定骨架目录时展开——业务字段下拉 + 实时预览 + 手动覆盖 */}
                    {b && w && (
                      <div className="mt-2 space-y-2 rounded-lg bg-teal-50/40 p-3 ring-1 ring-teal-100/60">
                        <div className="flex flex-wrap items-center gap-2">
                          <ToolbarSelect
                            value={w.docType}
                            onChange={(v) => patchWiz(i, { docType: v })}
                            options={[
                              { label: '文档类型 *', value: '' },
                              ...docTypeChoicesFor(b.eff.template).map((d) => ({ label: `${d.code}｜${d.name}`, value: d.code })),
                            ]}
                            className="w-44 [&>select]:w-full"
                          />
                          {/* R39 二阶段B：AI 语义预填命中徽标（仅预填下拉；手动改动后徽标消失） */}
                          {w.aiFilled && w.docType && (
                            <span
                              title="AI 按原文件名关键词预选的类型，可改选；确认前不会落地文件名"
                              className="cursor-help rounded-full bg-violet-50 px-2 py-0.5 text-[10px] whitespace-nowrap text-violet-600 ring-1 ring-violet-100"
                            >
                              AI 预填
                            </span>
                          )}
                          <ToolbarSelect
                            value={w.versionNo}
                            onChange={(v) => patchWiz(i, { versionNo: v })}
                            options={VERSION_OPTIONS.map((v) => ({ label: `V${v}`, value: v }))}
                            className="w-24 [&>select]:w-full"
                          />
                          <ToolbarSelect
                            value={w.docStatus}
                            onChange={(v) => patchWiz(i, { docStatus: v })}
                            options={[...DOC_STATUS_OPTIONS]}
                            className="w-24 [&>select]:w-full"
                          />
                          <span className="text-[11px] text-gray-400">试验编号 / 中心 / 日期已自动带入</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-[11px] text-gray-400">文件名预览</span>
                          <input
                            value={w.dirty ? w.override : wizRender(b.eff.template, w)}
                            onChange={(e) => patchWiz(i, { override: e.target.value, dirty: true })}
                            title="可手动修改；确认后以修改内容为准"
                            className={cn(
                              'h-8 min-w-0 flex-1 rounded-md border px-2 text-xs outline-none focus:ring-2',
                              w.dirty
                                ? 'border-amber-300 bg-amber-50/50 text-amber-700 focus:ring-amber-100'
                                : 'border-teal-200 bg-white font-medium text-teal-600 focus:ring-teal-100',
                            )}
                          />
                          {w.dirty && (
                            <button
                              type="button"
                              onClick={() => patchWiz(i, { override: '', dirty: false })}
                              className="shrink-0 text-[11px] text-teal-500 hover:underline"
                            >
                              恢复骨架
                            </button>
                          )}
                        </div>
                        {!w.docType && <div className="text-[11px] text-amber-500">请选择文档类型后才能确认上传</div>}
                        {w.docType &&
                          folderChildNames(b.folder.id).includes(w.dirty ? w.override : wizRender(b.eff.template, w)) && (
                            <div className="text-[11px] text-amber-500">目标文件夹内已存在同名文件，确认时将自动追加（2）</div>
                          )}
                      </div>
                    )}
                  </div>
                )
              })}
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
