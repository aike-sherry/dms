/* 归档自动路由：文档类型 → STUDY TMF「分区 / 文档类型」文件夹 的解析与落位计算
   PM TRANSFER 归档、REVIEW 审核通过、PdfPreview 归档、待分拣归位 共用，避免逻辑漂移 */
import { analyzeName, DOC_TYPE_NAMES, UNSORTED_ZONE } from '@/lib/smartDoc'
import { nextId, todayStr, type ArchiveRoute, type Catalog, type TmfFile } from '@/store'

export interface RouteEntry {
  id: string
  folderId: string
  parentId?: string
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
}

/** 路由解析：analyzeName 识别文档类型 → 查路由表；自定义类型按文件名包含匹配；兜底 99 待分拣 */
export function resolveRoute(routes: ArchiveRoute[], name: string): { zone: string; docType: string } {
  const a = analyzeName(name)
  if (a.matched) {
    const r = routes.find((x) => x.docType === a.docType)
    return r ? { zone: r.zone, docType: a.docType } : { zone: UNSORTED_ZONE, docType: '' }
  }
  const custom = routes.find((x) => x.docType && !DOC_TYPE_NAMES.includes(x.docType) && name.includes(x.docType))
  return custom ? { zone: custom.zone, docType: custom.docType } : { zone: UNSORTED_ZONE, docType: '' }
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
      return { catalog: cat, newFolders: placer.newFolders, entries, groups, siteGroups, unsorted }
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
    const { zone, docType } = resolveRoute(routes, t.name)
    const parentId = placer.place(zone, docType)
    if (zone === UNSORTED_ZONE) {
      unsorted += 1
    } else {
      const path = `${zone} / ${docType}`
      groups.set(path, (groups.get(path) ?? 0) + 1)
    }
    entries.push({ id: t.id, folderId: cat.id, parentId })
  }
  return { catalog: cat, newFolders: placer.newFolders, entries, groups, siteGroups, unsorted }
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
  const a = analyzeName(file.name)
  const docType = a.matched ? a.docType : ''
  const parentId = placer.place(zone, docType)
  const path = docType && zone !== UNSORTED_ZONE ? `${zone} / ${docType}` : zone
  return {
    catalog: cat,
    newFolders: placer.newFolders,
    entries: [{ id: file.id, folderId: cat.id, parentId }],
    groups: new Map([[path, 1]]),
    siteGroups: new Map(),
    unsorted: 0,
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
