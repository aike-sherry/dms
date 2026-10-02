import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Folder, FolderTree, Plus, Trash2, Upload, Download, FileSpreadsheet, ChevronDown, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ModalHeader } from '@/components/common'
import { cn } from '@/lib/utils'
import { useStore, nextId, todayStr, projPrefixMatch, PM_USER, type Catalog, type TmfFile, type TreeTemplate } from '@/store'
import {
  parseCatalogWorkbook,
  downloadCatalogTemplate,
  countCatalogTree,
  type ParsedCatalog,
  type CatalogNode,
} from '@/lib/catalogImport'

/* ModalHeader 已迁入 components/common；此处再导出以保持既有引用（Transfer/UploadDialog/SubmissionDialog/VersionHist/Admin 各页）不断裂 */
export { InfoField, ModalHeader } from '@/components/common'

/* 目录树预览（递归缩进）；导出供 admin 模板库预览复用 */
export function TreePreview({ nodes, depth }: { nodes: CatalogNode[]; depth: number }) {
  return (
    <ul className={depth > 0 ? 'mt-1 ml-4 space-y-1 border-l border-dashed border-gray-200 pl-3' : 'space-y-1'}>
      {nodes.map((n) => (
        <li key={n.name}>
          <div
            className={cn(
              'flex items-center gap-1.5 text-sm',
              depth === 0 ? 'font-semibold text-gray-800' : 'text-gray-600',
            )}
          >
            <Folder className={cn('h-3.5 w-3.5 shrink-0', depth === 0 ? 'text-teal-500' : 'text-gray-400')} />
            {n.name}
            {depth === 0 && n.children.length === 0 && (
              <span className="ml-1 text-xs font-normal text-gray-400">（无子项）</span>
            )}
          </div>
          {n.children.length > 0 && <TreePreview nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )
}

/* 行数据：一行 = 一个项目分组；SITE 型可勾选多家研究中心共用同一套目录结构（一次上传批量应用）。
   folderName = 项目文件夹（目录）名称：默认随项目编号自动生成，用户手动编辑后（nameDirty）不再跟随编号；
   R39 二阶段B：source=目录来源（null 未选 / template 引用标准模板 / excel 上传目录 Excel），
   选模板即把模板树拷贝为本行 parsed（走同一套创建/合并导入流程） */
interface Group {
  id: string
  projectNo: string
  folderName: string
  nameDirty: boolean
  centers: string[]
  source: 'template' | 'excel' | null
  templateId?: string
  fileName: string | null
  parsed: ParsedCatalog | null
  error: string | null
}

/** 模板 → ParsedCatalog（计数现算；rows 无 Excel 行概念置 0） */
const parsedFromTemplate = (t: TreeTemplate): ParsedCatalog => ({
  tree: t.tree,
  counts: countCatalogTree(t.tree),
  rows: 0,
})

/* R34 SITE 图纸模式行：一行 = 一家研究中心；TMF 名称默认 `{项目编号}-TMF-{中心名}` 随中心生成，
   用户手动编辑后（nameDirty）不再跟随 */
interface SiteRow {
  id: string
  center: string
  name: string
  nameDirty: boolean
}

/* 按 Excel 树在目标目录下批量建文件夹（同层级同名跳过）；返回新建条目与跳过数（自包含：existing=该目录现有文件夹） */
function materializeFolders(
  parsed: ParsedCatalog,
  cat: { id: string; projectNo: string; center?: string },
  existing: TmfFile[],
): { created: TmfFile[]; skipped: number } {
  const created: TmfFile[] = []
  let skipped = 0
  const mk = (name: string, parentId?: string): TmfFile => ({
    id: nextId('f'),
    name,
    kind: 'folder',
    projectNo: cat.projectNo,
    center: cat.center ?? '',
    uploader: PM_USER.name,
    uploadDate: todayStr(),
    size: '0KB',
    status: 'archived',
    folderId: cat.id,
    parentId,
  })
  const walk = (nodes: CatalogNode[], parentId?: string) => {
    for (const n of nodes) {
      const hit = [...existing, ...created].find((x) => x.parentId === parentId && x.name === n.name)
      let id: string
      if (hit) {
        skipped++
        id = hit.id
      } else {
        const nf = mk(n.name, parentId)
        created.push(nf)
        id = nf.id
      }
      walk(n.children, id)
    }
  }
  walk(parsed.tree)
  return { created, skipped }
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
  const { state, dispatch } = useStore()
  const [groups, setGroups] = useState<Group[]>([])
  /* 预览行 id：null = 紧凑单栏（预览默认收起）；点行内「预览/收起预览」切换，点另一行直接切换 */
  const [previewId, setPreviewId] = useState<string | null>(null)
  /* 勾选删除：行首 checkbox + 工具栏「删除」 */
  const [sel, setSel] = useState<Set<string>>(new Set())
  /* R26 最大化/还原：近全屏 96vw×92vh，标题栏图标切换，重开弹窗复位 */
  const [maximized, setMaximized] = useState(false)
  /* R26 双栏拖拽分隔条：右栏像素宽（null = CSS 默认 min(420px,38vw)），仅 ≥1100px 双栏生效 */
  const [rightW, setRightW] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  /* Excel 导入：当前点击「上传目录」的行 id（SITE 图纸模式为固定值 '__site__'：一份 Excel 应用到全部行） */
  const uploadGroupRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ===== R34 SITE 图纸模式状态：项目下拉 + 研究中心行表格 + 共享一份目录 Excel ===== */
  const [siteProject, setSiteProject] = useState('')
  const [siteRows, setSiteRows] = useState<SiteRow[]>([])
  /* R39 二阶段B：source=目录来源（template 引用标准模板 / excel 上传目录 Excel） */
  const [siteFile, setSiteFile] = useState<{ fileName: string; parsed: ParsedCatalog | null; error: string | null; source: 'template' | 'excel' } | null>(null)
  /* 上传解析成功/失败后自动展开右侧预览 */
  const [sitePreviewOpen, setSitePreviewOpen] = useState(false)
  /* R44：STUDY 行「导入目录」胶囊分段控件——记录展开了模板下拉的行 id（null = 各行均显示分段组） */
  const [tplPickerRow, setTplPickerRow] = useState<string | null>(null)

  /* R30：newGroup 支持预填项目编号（页面已按项目筛选时）；SITE 型按该项目已配置中心默认全选（已建目录不勾）。
     注意：调用时机均在 render 之后（useEffect / 事件回调），defaultName/centersForProject 虽已定义为后文 const 但可调 */
  const newGroup = (proj = ''): Group => ({
    id: nextId('cat-g'),
    projectNo: proj,
    folderName: proj ? defaultName(proj) : '',
    nameDirty: false,
    centers:
      proj && type === 'site'
        ? centersForProject(proj)
            .filter((o) => !o.built)
            .map((o) => o.name)
        : [],
    fileName: null,
    parsed: null,
    error: null,
    source: null,
  })

  useEffect(() => {
    if (open) {
      /* 页面已按某项目筛选（全局 Header 选择器）时预填编号 */
      const preset = state.activeProject !== '全部' ? state.activeProject : ''
      setGroups([newGroup(preset)])
      setPreviewId(null)
      setSel(new Set())
      setMaximized(false)
      setTplPickerRow(null)
      uploadGroupRef.current = null
      /* R34 SITE 图纸模式初始化：项目默认=页面筛选值（须为注册表有中心的项目），否则空（未选项目提交时拦截）；
         R38：预填项目时同步自动铺出该中心行 */
      if (type === 'site') {
        const projs = [...new Set(state.centers.map((c) => c.projectNo))].sort()
        const initProj = preset && projs.some((p) => projPrefixMatch(p, preset)) ? projs.find((p) => projPrefixMatch(p, preset))! : ''
        setSiteProject(initProj)
        setSiteRows(autoSiteRows(initProj))
        setSiteFile(null)
        setSitePreviewOpen(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type])

  /* 预览行：有解析结果或解析错误时可展开 */
  const previewRow = groups.find((g) => g.id === previewId && (g.parsed || g.error)) ?? null
  /* R34 SITE 图纸模式预览（与 STUDY previewRow 平行）：上传后自动展开，共用右栏面板 */
  const sitePreview = type === 'site' && sitePreviewOpen && siteFile ? siteFile : null
  const showPreview = type === 'site' ? sitePreview !== null : previewRow !== null

  /* 文件夹名称默认值：随项目编号自动生成（STUDY「{编号} STUDY TMF」/ SITE「{编号}-SITE TMF」） */
  const defaultName = (proj: string) => {
    const p = proj.trim()
    if (!p) return ''
    return type === 'site' ? `${p}-SITE TMF` : `${p} STUDY TMF`
  }
  /* 编号变化：用户未手动改过名称（nameDirty=false）时名称跟随编号重新生成；
     SITE 型同步重算中心默认勾选（未建目录全选、已建目录不勾） */
  const setProjectNo = (id: string, v: string) =>
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== id) return g
        const next: Group = {
          ...g,
          projectNo: v,
          folderName: g.nameDirty ? g.folderName : defaultName(v),
        }
        if (type === 'site') {
          next.centers = centersForProject(v)
            .filter((o) => !o.built)
            .map((o) => o.name)
        }
        return next
      }),
    )
  /* 名称手动编辑：置 dirty 后编号变化不再覆盖；清空视为放弃自定义，恢复跟随编号 */
  const setFolderName = (id: string, v: string) =>
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, folderName: v, nameDirty: v.trim() !== '' } : g)),
    )

  /* R32 指定项目下可下发的研究中心（SITE 行浮层勾选列表，数据源 = 首页「研究中心管理」注册表）：
     注册表中心按项目编号前缀双向匹配过滤；该中心+项目已有 site 目录的标「已建目录」（默认不勾选）。
     注册表外但已有目录的中心（如注册表条目被删）仍列出并标记已建，避免重复建目录 */
  const centersForProject = (projectNo: string): { name: string; built: boolean }[] => {
    const map = new Map<string, boolean>()
    const projMatch = (p: string) => !projectNo || projPrefixMatch(p, projectNo)
    for (const ct of state.centers) {
      if (projMatch(ct.projectNo)) map.set(ct.name, false)
    }
    for (const c of state.catalogs) {
      if (c.kind === 'site' && c.center && projMatch(c.projectNo)) map.set(c.center, true)
    }
    return [...map.entries()]
      .map(([name, built]) => ({ name, built }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  }

  const patchGroup = (id: string, patch: Partial<Group>) =>
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  const addRow = () => setGroups((prev) => [...prev, newGroup()])
  const removeRow = (id: string) => {
    if (groups.length <= 1) return
    setGroups((prev) => prev.filter((g) => g.id !== id))
    setSel((prev) => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
    if (previewId === id) setPreviewId(null)
  }
  const removeSelected = () => {
    const rest = groups.filter((g) => !sel.has(g.id))
    if (rest.length === 0) {
      toast.warning('至少保留 1 行')
      return
    }
    if (previewId && sel.has(previewId)) setPreviewId(null)
    setGroups(rest)
    setSel(new Set())
  }
  const toggleSel = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  /* ===== R34 SITE 图纸模式：行操作 ===== */
  /* 注册表里有中心的项目编号（去重排序）；无中心的项目不出现在选项；注册表为空 → 弹窗整体显示配置引导 */
  const siteProjects = [...new Set(state.centers.map((c) => c.projectNo))].sort()
  /* 该项目已配置中心（注册表前缀匹配 ∪ 已有 site 目录的中心并标已建），已选过的中心不再出现在下拉选项 */
  const siteCenterOpts = centersForProject(siteProject)
  const usedCenters = new Set(siteRows.map((r) => r.center).filter(Boolean))
  const addSiteRow = () => {
    if (!siteProject) {
      toast.warning('请先选择项目编号', { description: '左上角下拉选择项目后再添加研究中心行' })
      return
    }
    if (siteCenterOpts.filter((o) => !usedCenters.has(o.name)).length === 0) {
      toast.warning('该项目下的研究中心已全部添加')
      return
    }
    setSiteRows((prev) => [...prev, { id: nextId('cat-r'), center: '', name: '', nameDirty: false }])
  }
  /* 选中中心后 TMF 名称自动生成 `{项目编号}-TMF-{中心名}`（图纸命名）；用户手改后不再跟随 */
  const setSiteRowCenter = (id: string, center: string) =>
    setSiteRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, center, name: r.nameDirty ? r.name : center ? `${siteProject}-TMF-${center}` : '' } : r,
      ),
    )
  const setSiteRowName = (id: string, v: string) =>
    setSiteRows((prev) => prev.map((r) => (r.id === id ? { ...r, name: v, nameDirty: v.trim() !== '' } : r)))
  const removeSiteRow = (id: string) => setSiteRows((prev) => prev.filter((r) => r.id !== id))
  /* R38：把该项目注册表内的全部中心自动铺成行（TMF 名称按 `-TMF-` 规则生成，可编辑）；
     已建目录中心一并铺出并保留「已建目录，将合并导入」徽标——用户看到现成清单而非空表 */
  const autoSiteRows = (proj: string): SiteRow[] =>
    proj
      ? centersForProject(proj).map((o) => ({
          id: nextId('cat-r'),
          center: o.name,
          name: `${proj}-TMF-${o.name}`,
          nameDirty: false,
        }))
      : []
  /* 切换项目：中心行随项目自动重铺（注册表中心全量成行），避免跨项目中心串行 */
  const changeSiteProject = (v: string) => {
    setSiteProject(v)
    setSiteRows(autoSiteRows(v))
  }

  /* 上传 Excel → 解析 → 更新对应行（预览打开时实时刷新）；SITE 图纸模式一份应用到全部行并自动展开预览 */
  const pickForGroup = (id: string) => {
    uploadGroupRef.current = id
    fileInputRef.current?.click()
  }
  /* R39 二阶段B：引用标准模板——把模板树拷贝为本行/本单 parsed，走与 Excel 同一套预览与创建流程 */
  const applyTemplate = (id: string, templateId: string) => {
    const t = state.treeTemplates.find((x) => x.id === templateId)
    if (!t) return
    if (id === '__site__') {
      setSiteFile({ fileName: `标准模板：${t.name}`, parsed: parsedFromTemplate(t), error: null, source: 'template' })
      setSitePreviewOpen(true)
    } else {
      patchGroup(id, { source: 'template', templateId: t.id, fileName: `标准模板：${t.name}`, parsed: parsedFromTemplate(t), error: null })
      if (tplPickerRow === id) setTplPickerRow(null)
    }
  }
  /* 换来源：清空已选内容回到「引用模板 / 上传 Excel」二选一 */
  const resetSource = (id: string) => {
    if (id === '__site__') {
      setSiteFile(null)
      setSitePreviewOpen(false)
    } else {
      patchGroup(id, { source: null, templateId: undefined, fileName: null, parsed: null, error: null })
      if (previewId === id) setPreviewId(null)
    }
  }
  const onPicked = async (file: File | undefined) => {
    const id = uploadGroupRef.current
    if (!file || !id) return
    try {
      const parsed = /\.csv$/i.test(file.name)
        ? parseCatalogWorkbook(await file.text())
        : parseCatalogWorkbook(await file.arrayBuffer())
      if (id === '__site__') {
        setSiteFile({ fileName: file.name, parsed, error: null, source: 'excel' })
        setSitePreviewOpen(true)
      } else {
        patchGroup(id, { fileName: file.name, parsed, error: null, source: 'excel' })
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : '无法解析该文件'
      if (id === '__site__') {
        setSiteFile({ fileName: file.name, parsed: null, error, source: 'excel' })
        setSitePreviewOpen(true)
      } else {
        patchGroup(id, { fileName: file.name, parsed: null, error, source: 'excel' })
      }
    }
  }

  /* 确认创建：按 行×中心 批量执行——逐个 find-or-create 目录（R17 空白环境自动新建兜底保留）
     + 按 Excel 树建文件夹（同层级同名跳过），toast 汇总结果 */
  const readyGroups = groups.filter((g) => g.parsed)
  const noCenterGroups = type === 'site' ? readyGroups.filter((g) => g.centers.length === 0) : []
  const confirmAll = () => {
    if (readyGroups.length === 0) {
      toast.warning('请先引用标准模板或上传目录 Excel')
      return
    }
    const exec = readyGroups.filter((g) => type !== 'site' || g.centers.length > 0)
    if (exec.length === 0) {
      toast.warning('所选行均未勾选研究中心', { description: 'SITE 目录需至少勾选一家研究中心' })
      return
    }
    /* 项目编号与文件夹名称均必填（新建场景无既往编号可选，全部手输） */
    if (exec.some((g) => !g.projectNo.trim())) {
      toast.warning('请填写项目编号', { description: '每个待创建行的项目编号不能为空' })
      return
    }
    if (exec.some((g) => !g.folderName.trim())) {
      toast.warning('请填写文件夹名称', { description: '每个待创建行的文件夹名称不能为空' })
      return
    }
    const newCatalogs: Catalog[] = []
    const newFiles: TmfFile[] = []
    let catN = 0
    let folderN = 0
    let skipN = 0
    const projMatch = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a)
    const findCat = (proj: string, center?: string) =>
      [...state.catalogs, ...newCatalogs].find(
        (c) =>
          c.kind === type && projMatch(c.projectNo, proj) && (type === 'site' ? c.center === center : true),
      )
    for (const g of exec) {
      const proj = g.projectNo.trim()
      const baseName = g.folderName.trim()
      const targets: (string | undefined)[] = type === 'site' ? g.centers : [undefined]
      for (const center of targets) {
        let cat = findCat(proj, center)
        if (!cat) {
          cat = {
            id: nextId('cat'),
            kind: type,
            /* 目录名 = 行内文件夹名称；SITE 型自动追加「 —中心名」后缀 */
            name: type === 'site' ? `${baseName} —${center}` : baseName,
            projectNo: proj,
            center,
            creator: PM_USER.name,
            createDate: todayStr(),
            updateDate: todayStr(),
            size: '0KB',
            status: '未完成',
          }
          newCatalogs.push(cat)
          catN++
        }
        const existing = [...state.files, ...newFiles].filter(
          (x) => x.kind === 'folder' && x.status === 'archived' && x.folderId === cat.id,
        )
        const { created, skipped } = materializeFolders(g.parsed!, cat, existing)
        newFiles.push(...created)
        folderN += created.length
        skipN += skipped
      }
    }
    if (newCatalogs.length > 0) dispatch({ type: 'addCatalogs', catalogs: newCatalogs })
    if (newFiles.length > 0) dispatch({ type: 'addFiles', files: newFiles })
    toast.success('目录创建完成', {
      description: `新建目录 ${catN} 个 · 新建文件夹 ${folderN} 个 · 跳过同名 ${skipN} 个${
        noCenterGroups.length > 0 ? `；${noCenterGroups.length} 行未勾选中心已跳过` : ''
      }`,
    })
    onOpenChange(false)
  }

  /* ===== R34 SITE 图纸模式确认创建：逐中心行 find-or-create（目录名 = 行内 TMF 名称，已含中心），
     一份 Excel 树应用到全部行；校验顺序：未选项目 → 无中心行 → 行内中心/名称缺失 → 未上传解析成功 ===== */
  const confirmSite = () => {
    if (!siteProject) {
      toast.warning('请先选择项目编号', { description: '左上角下拉选择要下发目录的项目' })
      return
    }
    if (siteRows.length === 0) {
      toast.warning('请添加研究中心', { description: '点击右上角「⊕ 研究中心（点击添加）」添加行' })
      return
    }
    if (siteRows.some((r) => !r.center)) {
      toast.warning('存在未选择研究中心的行', { description: '请为每行选择研究中心，或删除多余行' })
      return
    }
    if (siteRows.some((r) => !r.name.trim())) {
      toast.warning('请填写 TMF 名称', { description: '每行的 TMF 名称不能为空' })
      return
    }
    if (!siteFile?.parsed) {
      toast.warning('请先引用标准模板或上传目录 Excel', { description: siteFile?.error ? `解析失败：${siteFile.error}` : '一份目录结构将应用到全部中心行' })
      return
    }
    const newCatalogs: Catalog[] = []
    const newFiles: TmfFile[] = []
    let catN = 0
    let folderN = 0
    let skipN = 0
    const projMatch = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a)
    for (const row of siteRows) {
      let cat = [...state.catalogs, ...newCatalogs].find(
        (c) => c.kind === 'site' && projMatch(c.projectNo, siteProject) && c.center === row.center,
      )
      if (!cat) {
        cat = {
          id: nextId('cat'),
          kind: 'site',
          name: row.name.trim(),
          projectNo: siteProject,
          center: row.center,
          creator: PM_USER.name,
          createDate: todayStr(),
          updateDate: todayStr(),
          size: '0KB',
          status: '未完成',
        }
        newCatalogs.push(cat)
        catN++
      }
      const existing = [...state.files, ...newFiles].filter(
        (x) => x.kind === 'folder' && x.status === 'archived' && x.folderId === cat.id,
      )
      const { created, skipped } = materializeFolders(siteFile.parsed, cat, existing)
      newFiles.push(...created)
      folderN += created.length
      skipN += skipped
    }
    if (newCatalogs.length > 0) dispatch({ type: 'addCatalogs', catalogs: newCatalogs })
    if (newFiles.length > 0) dispatch({ type: 'addFiles', files: newFiles })
    toast.success('目录创建完成', {
      description: `新建目录 ${catN} 个 · 新建文件夹 ${folderN} 个 · 跳过同名 ${skipN} 个`,
    })
    onOpenChange(false)
  }

  /* ===== R26 双栏拖拽分隔条：pointerdown/move/up 实时调整右栏宽度 =====
     约束：右栏 ≥320px、左栏 ≥480px（含 6px 分隔条）、右栏 ≤ 内容区 60%；拖拽期间禁止文本选择 */
  const clampRight = (w: number, bodyW: number) =>
    Math.round(Math.min(Math.max(w, 320), Math.max(320, Math.min(bodyW - 486, bodyW * 0.6))))
  const startSplitDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const body = bodyRef.current
    const asideEl = body?.querySelector('aside')
    if (!body || !asideEl) return
    const bodyW = body.getBoundingClientRect().width
    const startX = e.clientX
    const startW = asideEl.getBoundingClientRect().width
    setRightW(startW)
    setDragging(true)
    document.body.style.userSelect = 'none'
    const onMove = (ev: PointerEvent) => setRightW(clampRight(startW - (ev.clientX - startX), bodyW))
    const onUp = () => {
      setDragging(false)
      document.body.style.userSelect = ''
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }
  /* 视口缩放时按最新内容区宽度重新钳制右栏，避免拖过的像素宽撑破弹窗 */
  useEffect(() => {
    const onResize = () => {
      const bodyW = bodyRef.current?.getBoundingClientRect().width
      if (bodyW) setRightW((w) => (w === null ? null : clampRight(w, bodyW)))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* 仅 STUDY 表格空行 colSpan 使用（SITE 已为表单模式，无表格） */
  const colCount = 5

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          /* flex 纵列取代基样式 grid：杜绝隐式网格轨道被内容 min-content 横向撑宽（右侧裁切根因） */
          'flex max-h-[92vh] w-[92vw] flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 transition-[max-width] duration-300',
          maximized
            ? 'h-[92vh] w-[96vw] max-w-[96vw] sm:max-w-[96vw]'
            : showPreview
              ? 'sm:max-w-[min(92vw,72rem)]'
              : 'sm:max-w-5xl',
        )}
      >
        <DialogTitle className="sr-only">目录创建</DialogTitle>
        <ModalHeader
          title="目录创建"
          onClose={() => onOpenChange(false)}
          maximized={maximized}
          onToggleMaximize={() => setMaximized((m) => !m)}
        />

        {/* 窄屏（<1100px）：单栏整体滚动，预览面板堆叠在下方；宽屏双栏：左表格滚动 + 右预览内部滚动（树 flex-1 独立滚）；
            最大化时内容区 flex-1 撑满，底部按钮钉在弹窗底部 */}
        <div
          ref={bodyRef}
          className={cn(
            'flex min-w-0 flex-col overflow-y-auto min-[1100px]:flex-row min-[1100px]:overflow-visible',
            maximized ? 'min-h-0 flex-1' : 'max-h-[calc(92vh-112px)]',
          )}
        >
          {/* ===== 左栏：STUDY 保持目录行表格；SITE 为「项目目录批量下发」表单（R30） ===== */}
          <div className="min-w-0 flex-1 p-5 min-[1100px]:max-h-[calc(92vh-112px)] min-[1100px]:overflow-y-auto">
            {type === 'site' ? (
              /* ===== R34 图纸版式：顶部项目下拉 + 研究中心添加按钮，中部两列行表格，左下上传目录 ===== */
              state.centers.length === 0 ? (
                /* 注册表为空：整个弹窗显示配置引导 */
                <div className="flex flex-col items-center gap-3 py-16">
                  <p className="rounded-lg bg-amber-50/70 px-4 py-3 text-sm text-amber-600 ring-1 ring-amber-100">
                    请先在首页配置研究中心
                  </p>
                  <p className="text-xs text-gray-400">SITE TMF 目录下发依赖首页「研究中心管理」注册表中的项目与中心</p>
                </div>
              ) : (
              <div>
                {/* 顶部：左 项目编号下拉（选项=注册表有中心的项目，去重排序）｜ 右 ⊕ 研究中心（点击添加） */}
                <div className="mb-4 flex items-center gap-3">
                  <label className="text-sm whitespace-nowrap text-gray-600">项目编号</label>
                  <select
                    value={siteProject}
                    onChange={(e) => changeSiteProject(e.target.value)}
                    className={cn(
                      'w-56 rounded-lg border bg-white px-3 py-2 text-center text-sm outline-none transition-colors focus:border-teal-500',
                      siteProject ? 'border-gray-200 text-gray-700' : 'border-amber-300 bg-amber-50/60 text-gray-400',
                    )}
                  >
                    <option value="">请选择项目编号</option>
                    {siteProjects.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <span className="ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 border-teal-200 text-xs text-teal-600 hover:bg-teal-50"
                      onClick={addSiteRow}
                      title="添加一家研究中心（同一套目录结构将下发到所有行）"
                    >
                      <Plus className="h-3.5 w-3.5" /> 研究中心（点击添加）
                    </Button>
                  </span>
                </div>

                {/* 中部表格：研究中心 ｜ TMF 名称 ｜ 删除（表头/单元格/输入框全部居中——长期设计规范） */}
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-center text-xs font-medium whitespace-nowrap text-gray-500">
                        <th className="w-64 px-3 py-2.5 text-center">研究中心</th>
                        <th className="px-3 py-2.5 text-center">TMF 名称</th>
                        <th className="w-16 px-3 py-2.5 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {siteRows.map((r) => {
                        /* 已选过的中心不再出现在其他行选项（本行当前值保留） */
                        const opts = siteCenterOpts.filter((o) => !usedCenters.has(o.name) || o.name === r.center)
                        const built = siteCenterOpts.find((o) => o.name === r.center)?.built
                        return (
                          <tr key={r.id} className="border-t border-gray-100 transition-colors">
                            <td className="px-2 py-1.5 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <select
                                  value={r.center}
                                  onChange={(e) => setSiteRowCenter(r.id, e.target.value)}
                                  className={cn(
                                    'w-52 rounded-md border bg-white px-2 py-1.5 text-center text-sm outline-none transition-colors focus:border-teal-500',
                                    r.center ? 'border-gray-200 text-gray-700' : 'border-amber-300 bg-amber-50/60 text-gray-400',
                                  )}
                                >
                                  <option value="">请选择研究中心</option>
                                  {opts.map((o) => (
                                    <option key={o.name} value={o.name}>
                                      {o.name}
                                      {o.built ? '（已建目录）' : ''}
                                    </option>
                                  ))}
                                </select>
                                {built && (
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-600 ring-1 ring-amber-100">
                                    已建目录，将合并导入
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <input
                                value={r.name}
                                onChange={(e) => setSiteRowName(r.id, e.target.value)}
                                placeholder="选中中心后自动生成，可修改"
                                className={cn(
                                  'w-full rounded-md border bg-transparent px-2 py-1.5 text-center text-sm outline-none transition-colors focus:border-teal-500 focus:bg-white',
                                  r.name.trim()
                                    ? 'border-transparent hover:border-gray-200'
                                    : 'border-amber-300 bg-amber-50/60',
                                )}
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                type="button"
                                title="删除该行"
                                onClick={() => removeSiteRow(r.id)}
                                className="text-gray-300 transition-colors hover:text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                      {siteRows.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-10 text-center text-sm text-gray-400">
                            暂无研究中心行，点右上角「⊕ 研究中心（点击添加）」补行；
                            <br />
                            若该项目尚未配置研究中心，可先到首页「研究中心管理」新增
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 左下：目录来源二选一（R39 二阶段B：引用标准模板 / 上传目录，一份应用到全部行）+ 下载模板；
                    已选后文件名/模板名芯片（Excel 点击重传）+ 计数/解析失败 +「更换」回到二选一 */}
                <div className="mt-4 flex items-center gap-3">
                  {siteFile ? (
                    <>
                      {siteFile.source === 'template' ? (
                        <span
                          className="flex min-w-0 items-center gap-1.5 rounded-lg bg-teal-50/70 px-2.5 py-1.5 text-xs text-teal-700 ring-1 ring-teal-100"
                          title="引用标准目录树模板（已拷贝树结构，应用到全部中心行）"
                        >
                          <FolderTree className="h-3.5 w-3.5 shrink-0" />
                          <span className="max-w-56 truncate">{siteFile.fileName}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          title="点击重新上传"
                          onClick={() => pickForGroup('__site__')}
                          className="flex min-w-0 items-center gap-1.5 rounded-lg bg-teal-50/70 px-2.5 py-1.5 text-xs text-teal-700 ring-1 ring-teal-100 transition-colors hover:bg-teal-50"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                          <span className="max-w-56 truncate">{siteFile.fileName}</span>
                        </button>
                      )}
                      {siteFile.parsed && (
                        <span className="shrink-0 text-[10px] text-gray-400">
                          一级 {siteFile.parsed.counts[0]} · 二级 {siteFile.parsed.counts[1]}
                          {siteFile.parsed.counts[2] > 0 && ` · 三级 ${siteFile.parsed.counts[2]}`}
                        </span>
                      )}
                      {siteFile.error && (
                        <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-red-500 ring-1 ring-red-100">
                          解析失败
                        </span>
                      )}
                      <button
                        type="button"
                        title="更换目录来源"
                        onClick={() => resetSource('__site__')}
                        className="shrink-0 text-[10px] text-gray-400 transition-colors hover:text-teal-600 hover:underline"
                      >
                        更换
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        value=""
                        onChange={(e) => e.target.value && applyTemplate('__site__', e.target.value)}
                        disabled={state.treeTemplates.length === 0}
                        title={state.treeTemplates.length === 0 ? '模板库为空（admin 端 NAMING 页维护）' : '从标准目录树模板库引用，应用到全部中心行'}
                        className="w-44 cursor-pointer rounded-lg border border-gray-200 bg-white px-2 py-2 text-center text-xs text-teal-600 outline-none transition-colors hover:border-teal-300 focus:border-teal-500 disabled:cursor-not-allowed disabled:text-gray-300"
                      >
                        <option value="">
                          {state.treeTemplates.length === 0 ? '模板库为空' : '引用标准模板…'}
                        </option>
                        {state.treeTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => pickForGroup('__site__')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-teal-600 transition-colors hover:border-teal-400 hover:bg-teal-50/50"
                      >
                        <Upload className="h-3.5 w-3.5" /> 上传目录
                      </button>
                    </>
                  )}
                  <span className="ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={downloadCatalogTemplate}
                      title="下载 Excel 目录导入模板（一级目录/二级目录/三级目录）"
                    >
                      <Download className="h-3.5 w-3.5" /> 下载模板
                    </Button>
                  </span>
                </div>
                {siteFile?.error && (
                  <p className="mt-1.5 text-xs text-red-500">目录文件解析失败：{siteFile.error}</p>
                )}
              </div>
              )
            ) : (
            <>
            {/* 工具栏：下载模板 / ＋新建 / 删除（勾选删除模式） */}
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-800">
                目录列表<span className="ml-1.5 text-xs font-normal text-gray-400">（{groups.length}）</span>
              </span>
              <span className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={downloadCatalogTemplate}
                  title="下载 Excel 目录导入模板（一级目录/二级目录/三级目录）"
                >
                  <Download className="h-3.5 w-3.5" /> 下载模板
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={addRow}>
                  <Plus className="h-3.5 w-3.5" /> 新建
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 gap-1 text-xs',
                    sel.size > 0 && 'border-red-200 text-red-600 hover:bg-red-50',
                  )}
                  disabled={sel.size === 0}
                  title={sel.size === 0 ? '先勾选行' : '删除勾选行'}
                  onClick={removeSelected}
                >
                  <Trash2 className="h-3.5 w-3.5" /> 删除{sel.size > 0 ? `（${sel.size}）` : ''}
                </Button>
              </span>
            </div>

            {/* 干净表格：浅灰表头（居中）+ 细分隔线 + teal 文字链接；行内输入框无边框融入表格；
                min-w + 横向滚动：预览展开左栏变窄时表格不挤压换行 */}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="bg-gray-50 text-center text-xs font-medium whitespace-nowrap text-gray-500">
                    <th className="w-9 px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-teal-500"
                        checked={groups.length > 0 && sel.size === groups.length}
                        onChange={() =>
                          setSel(sel.size === groups.length ? new Set() : new Set(groups.map((g) => g.id)))
                        }
                      />
                    </th>
                    <th className="w-[160px] min-w-[160px] px-2 py-3">项目编号</th>
                    <th className="min-w-40 px-2 py-3">文件夹名称</th>
                    <th className="w-56 px-2 py-3">导入目录</th>
                    <th className="w-32 px-2 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => {
                    const isPreviewing = previewRow?.id === g.id
                    return (
                      <tr
                        key={g.id}
                        className={cn('border-t border-gray-100 transition-colors', isPreviewing && 'bg-teal-50/40')}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-teal-500"
                            checked={sel.has(g.id)}
                            onChange={() => toggleSel(g.id)}
                          />
                        </td>
                        {/* 项目编号：纯文本输入（新建场景不展示既往编号）；列宽 160px 容下完整 placeholder 与典型编号 */}
                        <td className="px-1 py-2.5 text-center">
                          <input
                            value={g.projectNo}
                            onChange={(e) => setProjectNo(g.id, e.target.value)}
                            placeholder="请输入项目编号"
                            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-center text-sm outline-none transition-colors hover:border-gray-200 focus:border-teal-500 focus:bg-white"
                          />
                        </td>
                        {/* 文件夹名称：默认随编号自动生成，可手改（dirty 后编号不再覆盖） */}
                        <td className="px-1 py-2.5 text-center">
                          <input
                            value={g.folderName}
                            onChange={(e) => setFolderName(g.id, e.target.value)}
                            placeholder="请输入文件夹名称"
                            className={cn(
                              'w-full rounded-md border bg-transparent px-2 py-1.5 text-center text-sm outline-none transition-colors focus:border-teal-500 focus:bg-white',
                              g.folderName.trim()
                                ? 'border-transparent hover:border-gray-200'
                                : 'border-amber-300 bg-amber-50/60',
                            )}
                          />
                        </td>
                        {/* 导入目录（R44 胶囊分段控件）：未选时并排分段组「标准模板 ▾ ｜ 上传 Excel」——
                            点「标准模板」单元格展开为模板下拉（可返回）；点「上传 Excel」直接调起文件选择；
                            已选显示来源芯片（模板=FolderTree 图标，Excel=表格图标点击重传）+「更换」回到分段组 */}
                        <td className="px-2 py-2.5 text-center">
                          {g.source === null ? (
                            tplPickerRow === g.id ? (
                              /* 展开态：模板下拉（autoFocus 即开）+ 返回分段组 */
                              <div className="flex items-center justify-center gap-1.5">
                                <select
                                  autoFocus
                                  value=""
                                  onChange={(e) => e.target.value && applyTemplate(g.id, e.target.value)}
                                  title="从标准目录树模板库引用"
                                  className="w-44 cursor-pointer rounded-full border border-teal-300 bg-white px-2.5 py-1.5 text-center text-xs text-teal-600 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                                >
                                  <option value="">选择标准模板…</option>
                                  {state.treeTemplates.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  title="返回目录来源选择"
                                  onClick={() => setTplPickerRow(null)}
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-teal-600"
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              /* 未选：胶囊分段控件 */
                              <div className="inline-flex items-center rounded-full bg-gray-100 p-0.5 ring-1 ring-gray-200/80">
                                <button
                                  type="button"
                                  disabled={state.treeTemplates.length === 0}
                                  title={state.treeTemplates.length === 0 ? '模板库为空（admin 端 NAMING 页维护）' : '引用标准目录树模板'}
                                  onClick={() => setTplPickerRow(g.id)}
                                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-gray-500 transition-all hover:bg-white hover:text-teal-600 hover:shadow-sm disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent disabled:hover:shadow-none"
                                >
                                  <FolderTree className="h-3.5 w-3.5" /> 标准模板
                                  <ChevronDown className="h-3 w-3 opacity-60" />
                                </button>
                                <span className="h-3.5 w-px bg-gray-300/70" />
                                <button
                                  type="button"
                                  title="上传目录 Excel"
                                  onClick={() => pickForGroup(g.id)}
                                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-gray-500 transition-all hover:bg-white hover:text-teal-600 hover:shadow-sm"
                                >
                                  <Upload className="h-3.5 w-3.5" /> 上传 Excel
                                </button>
                              </div>
                            )
                          ) : (
                            <div className="flex min-w-0 items-center justify-center gap-1.5">
                              {g.source === 'template' ? (
                                <span className="flex min-w-0 items-center gap-1 text-xs text-teal-600" title="引用标准目录树模板（已拷贝树结构）">
                                  <FolderTree className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{g.fileName}</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  title="点击重新上传"
                                  onClick={() => pickForGroup(g.id)}
                                  className="flex min-w-0 items-center gap-1 text-xs text-teal-600 hover:underline"
                                >
                                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{g.fileName}</span>
                                </button>
                              )}
                              {g.error && (
                                <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-red-500 ring-1 ring-red-100">
                                  解析失败
                                </span>
                              )}
                              <button
                                type="button"
                                title="更换目录来源"
                                onClick={() => resetSource(g.id)}
                                className="shrink-0 text-[10px] text-gray-400 transition-colors hover:text-teal-600 hover:underline"
                              >
                                更换
                              </button>
                            </div>
                          )}
                        </td>
                        {/* 操作：预览/收起预览（未上传禁用）+ 删除 */}
                        <td className="px-2 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2.5 whitespace-nowrap">
                            <button
                              type="button"
                              disabled={!g.parsed && !g.error}
                              title={!g.parsed && !g.error ? '请先上传目录 Excel' : undefined}
                              onClick={() => setPreviewId(isPreviewing ? null : g.id)}
                              className="text-xs text-teal-600 transition-colors hover:text-teal-700 hover:underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
                            >
                              {isPreviewing ? '收起预览' : '预览'}
                            </button>
                            <button
                              type="button"
                              title={groups.length <= 1 ? '至少保留 1 行' : '删除该行'}
                              disabled={groups.length <= 1}
                              onClick={() => removeRow(g.id)}
                              className="text-gray-300 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-gray-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {groups.length === 0 && (
                    <tr>
                      <td colSpan={colCount} className="py-10 text-center text-sm text-gray-400">
                        暂无目录行，点右上角「＋ 新建」添加
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </>
            )}
          </div>

          {/* ===== 右栏：预览面板（默认收起；点行内「预览」展开，R18 过渡 + R19 树滚动）。
              宽屏 flex 纵列固定高：统计/摘要 shrink-0，目录树 flex-1 min-h-0 内部滚动（不整栏滚）；
              R26：宽度响应式默认 min(420px,38vw)，分隔条拖拽后取 --rw 像素值 ===== */}
          {showPreview && (
            <>
              {/* 拖拽分隔条：仅 ≥1100px 双栏显示；6px 热区 cursor-col-resize，悬停/拖拽 teal 高亮 */}
              <div
                role="separator"
                aria-orientation="vertical"
                title="拖拽调整左右栏宽度"
                onPointerDown={startSplitDrag}
                className="group hidden w-1.5 shrink-0 cursor-col-resize touch-none justify-center select-none min-[1100px]:flex"
              >
                <div
                  className={cn(
                    'w-px bg-gray-200 transition-all group-hover:w-[3px] group-hover:rounded-full group-hover:bg-teal-400',
                    dragging && 'w-[3px] rounded-full bg-teal-500',
                  )}
                />
              </div>
            <aside
              style={{ '--rw': rightW === null ? undefined : `${rightW}px` } as CSSProperties}
              className="flex w-full shrink-0 flex-col border-t border-gray-100 bg-gray-50/50 p-5 min-[1100px]:max-h-[calc(92vh-112px)] min-[1100px]:w-[var(--rw,min(420px,38vw))] min-[1100px]:border-t-0"
            >
              {/* 统一预览数据源：STUDY=previewRow（行），SITE=sitePreview（整单共享一份 Excel） */}
              {(() => {
                const pvFileName = type === 'site' ? (sitePreview?.fileName ?? '') : (previewRow?.fileName ?? '')
                const pvParsed = type === 'site' ? sitePreview?.parsed : previewRow?.parsed
                const pvError = type === 'site' ? sitePreview?.error : previewRow?.error
                return (
                  <>
              <div className="mb-4 flex shrink-0 items-center gap-2 text-sm font-medium text-gray-800">
                <FileSpreadsheet className="h-4 w-4 text-teal-500" />
                目录实时预览
                <span className="ml-auto text-xs font-normal text-gray-400">
                  {type === 'site'
                    ? siteProject
                      ? `项目 ${siteProject}`
                      : '当前项目'
                    : previewRow?.projectNo
                      ? `分组 ${previewRow.projectNo}`
                      : '当前行'}
                </span>
              </div>

              {pvParsed ? (
                <>
                  {/* 来源 + 统计 */}
                  <div className="mb-4 shrink-0 rounded-xl bg-teal-50/70 px-4 py-3 ring-1 ring-teal-100">
                    <div className="flex items-center gap-2 text-sm text-teal-800">
                      <FileSpreadsheet className="h-4 w-4 shrink-0" />
                      <span className="truncate font-medium">{pvFileName}</span>
                    </div>
                    <div className="mt-1.5 text-xs text-teal-600">
                      将创建 一级 {pvParsed.counts[0]} 个 · 二级 {pvParsed.counts[1]} 个
                      {pvParsed.counts[2] > 0 && ` · 三级 ${pvParsed.counts[2]} 个`}
                    </div>
                  </div>

                  {/* 目标范围摘要（含最终目录名称预览；SITE 图纸模式逐行显示各行 TMF 名称） */}
                  <div className="mb-4 shrink-0 rounded-xl bg-white px-4 py-3 text-xs leading-5 text-gray-600 ring-1 ring-gray-100">
                    {type === 'site' ? (
                      siteRows.length > 0 ? (
                        <>
                          将下发到{' '}
                          <span className="font-medium text-teal-600">{siteRows.length} 家中心</span>
                          <div className="mt-1 space-y-0.5">
                            {siteRows.map((r) => (
                              <div key={r.id} className="truncate text-teal-700">
                                → {r.name.trim() || (r.center ? `${siteProject}-TMF-${r.center}` : '（请选择研究中心）')}
                              </div>
                            ))}
                          </div>
                          <div className="mt-0.5 text-gray-400">目录无则自动新建（已建目录合并导入），同名文件夹自动跳过</div>
                        </>
                      ) : (
                        <span className="text-amber-600">
                          尚未添加研究中心行：请在左侧点「⊕ 研究中心（点击添加）」
                        </span>
                      )
                    ) : (
                      <>
                        将导入项目目录：
                        <span className="font-medium text-teal-600">
                          {previewRow?.folderName.trim() || '（请填写文件夹名称）'}
                        </span>
                        <div className="mt-0.5 text-gray-400">目录无则自动新建，同名文件夹自动跳过</div>
                      </>
                    )}
                  </div>

                  {/* 目录树：占满右栏剩余高度并内部滚动 */}
                  <div className="max-h-[50vh] min-h-0 flex-1 overflow-y-auto rounded-xl border border-gray-100 bg-white p-4 shadow-sm min-[1100px]:max-h-none">
                    <TreePreview nodes={pvParsed.tree} depth={0} />
                  </div>
                </>
              ) : (
                /* 解析失败：面板内错误提示（不弹 toast 遮拦） */
                <div className="shrink-0 rounded-xl bg-red-50 px-4 py-3 ring-1 ring-red-100">
                  <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                    <FileSpreadsheet className="h-4 w-4 shrink-0" />
                    <span className="truncate">{pvFileName}</span>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-red-500">目录文件解析失败：{pvError}</p>
                  <p className="mt-2 text-xs text-gray-400">请检查文件格式后重新点击「上传目录」选择文件</p>
                </div>
              )}
                  </>
                )
              })()}
            </aside>
            </>
          )}
        </div>

        {/* 底部固定操作（取消 / 确认创建，右下）；SITE 图纸模式可确认条件=目录 Excel 解析成功 */}
        <div className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-5 py-4">
          {(type === 'site' ? !siteFile?.parsed : readyGroups.length === 0) && (
            <span className="text-xs text-gray-400">请先引用标准模板或上传目录 Excel</span>
          )}
          <span className="ml-auto" />
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            size="sm"
            className="bg-teal-500 text-white hover:bg-teal-600"
            disabled={type === 'site' ? !siteFile?.parsed : readyGroups.length === 0}
            onClick={type === 'site' ? confirmSite : confirmAll}
          >
            确认创建
          </Button>
        </div>

        {/* Excel 目录导入：.xlsx / .xls / .csv，单选，归属当前点击的行 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            void onPicked(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
