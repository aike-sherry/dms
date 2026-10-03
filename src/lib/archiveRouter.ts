/* 归档自动路由：文档类型 → STUDY TMF「分区 / 文档类型」文件夹 的解析与落位计算
   PM TRANSFER 归档、REVIEW 审核通过、PdfPreview 归档、待分拣归位 共用，避免逻辑漂移 */
import { analyzeName, DOC_TYPE_NAMES, UNSORTED_ZONE } from '@/lib/smartDoc'
import { nextId, todayStr, type ArchiveRoute, type Catalog, type TmfFile } from '@/store'

/** 路由来源：'docType' = 读落库结构化业务字段（字典 code 映射后查表）；'filenameParse' = analyzeName 文件名解析兜底（旧行为） */
export type RouteSource = 'docType' | 'filenameParse'

/** C4 主路由映射：文档类型字典 code（TmfFile.docType，R39 落库业务字段）→ smartDoc 词典 type（ArchiveRoute 路由表口径）。
    两套词表天然不一致（字典 code 如「方案」vs 词典 type 如「研究方案」），显式映射避免靠字符串模糊猜；
    词典中无对应类型的 code（如「会议纪要」）不建映射——自动降级 analyzeName 文件名解析，行为与现状一致 */
export const DICT_CODE_TO_ROUTE_TYPE: Record<string, string> = {
  方案: '研究方案',
  知情同意: '知情同意书',
  伦理批件: '伦理委员会批件',
  方案修订: '研究方案',
  简历: '研究者简历',
  实验室报告: '实验室检查报告',
  SAE报告: '严重不良事件报告',
  SAE随访: '严重不良事件报告',
  访视报告: '监查报告',
}

export interface RouteEntry {
  id: string
  folderId: string
  parentId?: string
  /** C4：本条落位的路由来源（仅经路由表判定的条目带；targetFolderId 直通/文件夹根落位不带） */
  routeSource?: RouteSource
}

export interface ArchivePlan {
  catalog: Catalog
  newFolders: TmfFile[]
  entries: RouteEntry[]
  /** 目标路径（分区 / 文档类型）→ 文件数（不含 99 待分拣） */
  groups: Map<string, number>
  /** CRA 选定目标文件夹的直达归档：目标路径（中心 / 文件夹名，SITE TMF 下）→ 文件数 */
  siteGroups: Map<string, number>
  /** 进入 99 待分拣的文件数 */
  unsorted: number
  /** C4：本 plan 经路由表判定条目的来源计数（直通条目不计入） */
  routeSources: Record<RouteSource, number>
}

/** 路由解析（C4 升级）：① 文件落库带 docType 业务字段且字典 code 可映射到词典类型 → 以 docType 为准查路由表
    （表项被 PM 删时按旧对称行为进 99 待分拣，source 仍记 docType）；② 无 docType 或 code 未映射 →
    analyzeName 识别文档类型 → 查路由表；自定义类型按文件名包含匹配；兜底 99 待分拣（与 C4 前行为逐行一致） */
export function resolveRoute(
  routes: ArchiveRoute[],
  name: string,
  fileDocType?: string,
): { zone: string; docType: string; source: RouteSource } {
  if (fileDocType) {
    const routeType = DICT_CODE_TO_ROUTE_TYPE[fileDocType]
    if (routeType) {
      const r = routes.find((x) => x.docType === routeType)
      return r
        ? { zone: r.zone, docType: routeType, source: 'docType' }
        : { zone: UNSORTED_ZONE, docType: '', source: 'docType' }
    }
  }
  const a = analyzeName(name)
  if (a.matched) {
    const r = routes.find((x) => x.docType === a.docType)
    return r
      ? { zone: r.zone, docType: a.docType, source: 'filenameParse' }
      : { zone: UNSORTED_ZONE, docType: '', source: 'filenameParse' }
  }
  const custom = routes.find((x) => x.docType && !DOC_TYPE_NAMES.includes(x.docType) && name.includes(x.docType))
  return custom
    ? { zone: custom.zone, docType: custom.docType, source: 'filenameParse' }
    : { zone: UNSORTED_ZONE, docType: '', source: 'filenameParse' }
}

/** 目标 STUDY TMF 目录：优先同项目编号，回退第一个 STUDY 目录 */
export function findStudyCatalog(catalogs: Catalog[], projectNo: string): Catalog | undefined {
  return (
    catalogs.find((c) => c.kind === 'study' && c.projectNo === projectNo) ??
    catalogs.find((c) => c.kind === 'study')
  )
}

/** 落位器：在 files 副本上确保分区/文档类型文件夹存在（不存在则创建，结构与 TmfPage 钻取视图一致） */
function makePlacer(cat: Catalog, files: TmfFile[], uploader: string, center: string) {
  const pool: TmfFile[] = [...files]
  const newFolders: TmfFile[] = []
  const mkFolder = (name: string, parentId?: string): TmfFile => ({
    id: nextId('f'),
    name,
    kind: 'folder',
    projectNo: cat.projectNo,
    center,
    uploader,
    uploadDate: todayStr(),
    size: '0KB',
    status: 'archived',
    folderId: cat.id,
    parentId,
  })
  /* 分区文件夹：挂 catalog 根（folderId = catalog id，无 parentId） */
  const ensureZone = (zone: string): string => {
    const hit = pool.find(
      (x) => x.kind === 'folder' && x.status === 'archived' && x.folderId === cat.id && !x.parentId && x.name === zone,
    )
    if (hit) return hit.id
    const nf = mkFolder(zone)
    pool.push(nf)
    newFolders.push(nf)
    return nf.id
  }
  /* 文档类型文件夹：挂分区文件夹下 */
  const ensureDoc = (zoneId: string, docType: string): string => {
    const hit = pool.find(
      (x) => x.kind === 'folder' && x.status === 'archived' && x.parentId === zoneId && x.name === docType,
    )
    if (hit) return hit.id
    const nf = mkFolder(docType, zoneId)
    pool.push(nf)
    newFolders.push(nf)
    return nf.id
  }
  /** 文件应落位的 parentId：docType 为空或目标为 99 待分拣时直接放分区文件夹下 */
  const place = (zone: string, docType: string): string => {
    const zoneId = ensureZone(zone)
    return docType && zone !== UNSORTED_ZONE ? ensureDoc(zoneId, docType) : zoneId
  }
  return { newFolders, place }
}

/** 计算 文件/文件夹 的路由归档落位：文件夹本身归入目录根，内部子文件各自路由；
    CRA 确认命名时选定了目标文件夹（targetFolderId）且该文件夹仍存在 → 直接落入该 SITE TMF 文件夹，
    跳过路由表；文件夹已被删时回退路由表逻辑 */
export function planArchive(args: {
  file: TmfFile
  children: TmfFile[]
  files: TmfFile[]
  catalogs: Catalog[]
  routes: ArchiveRoute[]
  uploader: string
}): ArchivePlan | null {
  const { file, children, files, catalogs, routes, uploader } = args
  const cat = findStudyCatalog(catalogs, file.projectNo)
  if (!cat) return null
  const placer = makePlacer(cat, files, uploader, file.center)
  const entries: RouteEntry[] = []
  const groups = new Map<string, number>()
  const siteGroups = new Map<string, number>()
  const routeSources: Record<RouteSource, number> = { docType: 0, filenameParse: 0 }
  let unsorted = 0
  /* R27：文件夹条目自身带 targetFolderId（PM 上传弹窗选定目标文件夹）且目标仍存在 →
     文件夹连同子文件整体直通落入该文件夹（子文件保持 parentId=本文件夹，不再各自走路由表） */
  if (file.kind === 'folder') {
    const tf = file.targetFolderId
      ? files.find((x) => x.id === file.targetFolderId && x.kind === 'folder')
      : undefined
    if (tf) {
      const fid = tf.folderId ?? cat.id
      entries.push({ id: file.id, folderId: fid, parentId: tf.id })
      for (const t of children) entries.push({ id: t.id, folderId: fid, parentId: file.id })
      siteGroups.set([...[tf.center, tf.name].filter(Boolean), file.name].join(' / '), children.length)
      return { catalog: cat, newFolders: placer.newFolders, entries, groups, siteGroups, unsorted, routeSources }
    }
    entries.push({ id: file.id, folderId: cat.id })
  }
  const targets = file.kind === 'folder' ? children : [file]
  for (const t of targets) {
    /* 直达归档：CRA 选定的 PM 文件夹仍存在 → 落入该文件夹（folderId = 所属 SITE 目录，parentId = 文件夹 id） */
    const tf = t.targetFolderId ? files.find((x) => x.id === t.targetFolderId && x.kind === 'folder') : undefined
    if (tf) {
      entries.push({ id: t.id, folderId: tf.folderId ?? cat.id, parentId: tf.id })
      const path = [tf.center ?? file.center, tf.name].filter(Boolean).join(' / ')
      siteGroups.set(path, (siteGroups.get(path) ?? 0) + 1)
      continue
    }
    /* C4：优先读落库 docType 业务字段路由，无字段/未映射才降级 analyzeName 文件名解析 */
    const { zone, docType, source } = resolveRoute(routes, t.name, t.docType)
    routeSources[source] += 1
    const parentId = placer.place(zone, docType)
    if (zone === UNSORTED_ZONE) {
      unsorted += 1
    } else {
      const path = `${zone} / ${docType}`
      groups.set(path, (groups.get(path) ?? 0) + 1)
    }
    entries.push({ id: t.id, folderId: cat.id, parentId, routeSource: source })
  }
  return { catalog: cat, newFolders: placer.newFolders, entries, groups, siteGroups, unsorted, routeSources }
}

/** 计算单文件归位落位（待分拣 → 所选分区）：文档类型识别不了时直接放分区文件夹下 */
export function planRehome(args: {
  file: TmfFile
  zone: string
  files: TmfFile[]
  catalogs: Catalog[]
  uploader: string
}): ArchivePlan | null {
  const { file, zone, files, catalogs, uploader } = args
  const cat = findStudyCatalog(catalogs, file.projectNo)
  if (!cat) return null
  const placer = makePlacer(cat, files, uploader, file.center)
  /* C4：归位的文档类型子文件夹判定同样优先落库 docType 字段（映射词典口径），无字段/未映射降级 analyzeName */
  const viaField = file.docType ? DICT_CODE_TO_ROUTE_TYPE[file.docType] : undefined
  const source: RouteSource = viaField ? 'docType' : 'filenameParse'
  const docType = viaField ?? (() => {
    const a = analyzeName(file.name)
    return a.matched ? a.docType : ''
  })()
  const parentId = placer.place(zone, docType)
  const path = docType && zone !== UNSORTED_ZONE ? `${zone} / ${docType}` : zone
  return {
    catalog: cat,
    newFolders: placer.newFolders,
    entries: [{ id: file.id, folderId: cat.id, parentId, routeSource: source }],
    groups: new Map([[path, 1]]),
    siteGroups: new Map(),
    unsorted: 0,
    routeSources: { docType: source === 'docType' ? 1 : 0, filenameParse: source === 'filenameParse' ? 1 : 0 },
  }
}

/** 判断文件是否处于「99 待分拣」分区：祖先文件夹链含 99 待分拣（调用方按 kind 过滤，文件夹本身不计数） */
export function inUnsortedZone(f: TmfFile, byId: Map<string, TmfFile>): boolean {
  let cur = f.parentId ? byId.get(f.parentId) : undefined
  for (let depth = 0; cur && depth < 10; depth += 1) {
    if (cur.kind === 'folder' && cur.name === UNSORTED_ZONE) return true
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return false
}
