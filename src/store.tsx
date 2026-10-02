import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react'
import { studyFolders, siteFolders, submissionFiles, submissionHospitals, submissionOverviewRows } from '@/data/mock'
import { DEFAULT_ZONE_BY_DOC_TYPE, DEFAULT_NAMING_TEMPLATE } from '@/lib/smartDoc'

/* ================= 类型 ================= */

export type Role = 'pm' | 'executor' | 'admin'

/** uploaded=执行端待提交 | pending=已提交待审核 | rejected=已驳回 | archived=已归档 */
export type FileStatus = 'uploaded' | 'pending' | 'rejected' | 'archived'
export type FileKind = 'folder' | 'pdf'

export interface TmfFile {
  id: string
  name: string
  kind: FileKind
  projectNo: string
  center: string
  uploader: string
  uploadDate: string
  size: string
  status: FileStatus
  /** 驳回原因 */
  reason?: string
  /** 归档目标文件夹（catalog id） */
  folderId?: string
  /** 所属传输文件夹（文件在文件夹内时的父级 id） */
  parentId?: string
  /** 版本链：上一版本文件 id（上传时同文档新版本自动递增命名并关联历史版本） */
  versionOf?: string
  /** CRA 确认命名时选中的目标文件夹 id（PM 在该中心 SITE TMF 下已建的文件夹）；
      审核通过后直接归档进该文件夹、跳过路由表；选的是回退标准类型时无此字段 */
  targetFolderId?: string
  /* ===== R39 模式A：目录绑定命名范式骨架（GCP 合规字段） ===== */
  /** 文件夹绑定的命名骨架 id（仅 kind='folder' 有意义；解析有效骨架时沿祖先链向上找最近绑定——绑定继承） */
  namingTemplateId?: string
  /** 原始上传文件名：永久保存不可改（审计溯源），仅创建时写入一次 */
  originalFilename?: string
  /** 对外展示/下载用文件名；每次修改写 namingLogs 审计。旧数据缺失时兜底 = name */
  displayFilename?: string
  /** 版本号（独立业务字段，如 '1.0'；业务逻辑禁止从文件名字符串解析） */
  versionNo?: string
  /** 文档状态：草稿/审核中/终版/作废（独立业务字段） */
  docStatus?: string
  /** 文档类型简称（独立业务字段，取自 docTypes 字典 code） */
  docType?: string
}

export interface Catalog {
  id: string
  kind: 'study' | 'site'
  name: string
  projectNo: string
  center?: string
  creator: string
  createDate: string
  updateDate: string
  size: string
  status: '完成' | '未完成'
}

export interface Submission {
  id: string
  topic: string
  fileName: string
  kind: FileKind
  projectNo: string
  uploadDate: string
  size: string
  published: boolean
  /** 目标递交时限（新建递交时设置；发布时随概况矩阵行展示。上传渠道创建的递交无此字段） */
  deadline?: string
}

/** 递交概况矩阵行：每家医院的递交日期由执行人员录入，dates 以医院名为键 */
export interface SubmissionScheduleRow {
  id: string
  topic: string
  publishDate: string
  deadline: string
  dates: Record<string, string>
}

/** 归档路由：文档类型 → STUDY TMF 分区（PM TRANSFER「归档规则」维护） */
export interface ArchiveRoute {
  id: string
  docType: string
  zone: string
}

/** R32 研究中心注册表：全系统唯一中心数据源（首页「研究中心管理」维护）。
    cra 为临床监查员姓名（取自后台执行人员账号），可为空（未分配） */
export interface Center {
  id: string
  name: string
  projectNo: string
  cra: string
}

/* ===== R39 模式A：命名范式骨架库 / 文档类型字典 / 命名审计 ===== */

/** 命名范式骨架（全局库，仅 admin 可维护语法；PM 只能选用启用中的骨架绑定目录）。
    骨架字符串用 {} 占位符；docTypeFilter 限定可选文档类型（id 列表，空=不过滤，二阶段字典筛选扩展点已预留） */
export interface NamingTemplate {
  id: string
  name: string
  skeleton: string
  status: '启用' | '停用'
  remark?: string
  docTypeFilter?: string[]
}

/** 文档类型字典：简称=命名占位符 {文件类型简称} 的取值；分类用于字典筛选/管理 */
export interface DocType {
  id: string
  code: string
  name: string
  category: string
}

/** 命名审计日志：创建命名与每次 displayFilename 修改各写一条（操作人/时间/旧值/新值）。
    R39 二阶段A：补 projectNo/role/originalFilename 冗余字段（文件删除后审计仍可读）；
    action 增加「重名追加」（上传时目标文件夹同名自动加序号，oldValue=期望名、newValue=实际名） */
export interface NamingLog {
  id: string
  fileId: string
  operator: string
  /** YYYY-MM-DD HH:mm */
  time: string
  action: '创建命名' | '修改文件名' | '重名追加'
  oldValue: string
  newValue: string
  /** 冗余展示字段（admin AUDIT 页筛选/列）：创建时写入，旧日志缺失时显示 — */
  projectNo?: string
  role?: Role
  originalFilename?: string
}

/** 骨架库种子：系统配置，不受 DEMO_MODE 影响，始终加载（业务数据仍为空） */
export const DEFAULT_NAMING_TEMPLATES: NamingTemplate[] = [
  { id: 'nt1', name: '方案类文件命名', skeleton: '{试验编号}-{文件类型简称}-V{版本号}-{YYYYMMDD}', status: '启用', remark: '方案/知情同意等通用文档', docTypeFilter: ['dt1', 'dt2', 'dt4'] },
  { id: 'nt2', name: 'SAE 上报资料', skeleton: '{试验编号}-{中心编号}-SAE{SAE序号}-{文件类型简称}-{YYYYMMDD}', status: '启用', remark: '严重不良事件上报专用', docTypeFilter: ['dt7', 'dt8'] },
  { id: 'nt3', name: '会议纪要命名', skeleton: '{试验编号}-{文件类型简称}-{YYYYMMDD}-V{版本号}', status: '启用', remark: '会议记录/沟通材料', docTypeFilter: ['dt9'] },
  { id: 'nt4', name: '访视报告命名（停用示例）', skeleton: '{试验编号}-{中心编号}-{访视编号}-{文件类型简称}-{YYYYMMDD}', status: '停用', remark: '待 SIV/RMV 编号规则确认后启用', docTypeFilter: ['dt10'] },
]

/** 文档类型字典种子：系统配置，不受 DEMO_MODE 影响 */
export const DEFAULT_DOC_TYPES: DocType[] = [
  { id: 'dt1', code: '方案', name: '临床试验方案', category: '方案' },
  { id: 'dt2', code: '知情同意', name: '知情同意书', category: '伦理' },
  { id: 'dt3', code: '伦理批件', name: '伦理委员会批件', category: '伦理' },
  { id: 'dt4', code: '方案修订', name: '方案修订案/补充说明', category: '方案' },
  { id: 'dt5', code: '简历', name: '研究者简历', category: '人员' },
  { id: 'dt6', code: '实验室报告', name: '实验室检验报告', category: '数据' },
  { id: 'dt7', code: 'SAE报告', name: '严重不良事件报告表', category: 'SAE' },
  { id: 'dt8', code: 'SAE随访', name: 'SAE 随访/总结报告', category: 'SAE' },
  { id: 'dt9', code: '会议纪要', name: '会议纪要/沟通记录', category: '会议' },
  { id: 'dt10', code: '访视报告', name: '监查访视报告', category: '监查' },
]

/** 默认归档路由：系统配置，不受 DEMO_MODE 影响，始终加载 */
export const DEFAULT_ARCHIVE_ROUTES: ArchiveRoute[] = Object.entries(DEFAULT_ZONE_BY_DOC_TYPE).map(
  ([docType, zone], i) => ({ id: `ar${i + 1}`, docType, zone }),
)

export interface State {
  authed: boolean
  role: Role
  /** 全局项目筛选（顶部 Header 下拉）；'全部' 表示不过滤，仅会话内状态不持久化 */
  activeProject: string
  files: TmfFile[]
  catalogs: Catalog[]
  submissions: Submission[]
  submissionSchedule: SubmissionScheduleRow[]
  /** 归档路由表：文档类型 → STUDY TMF 分区 */
  archiveRoutes: ArchiveRoute[]
  /** 命名规则模板（PM TRANSFER「命名规则」配置；CRA 上传确认命名与 PM 上传自动命名按模板渲染） */
  namingTemplate: string
  /** 收藏：文件 id → 收藏日期（仅具体文件可收藏，文件夹不可） */
  favorites: Record<string, string>
  /** 研究中心 → CRA 姓名映射（R32 前首页 CRA 分配模块的遗留存储；R32 起仅用于向 centers 注册表迁移，不再作为读取源） */
  craMap: Record<string, string>
  /** R32 研究中心注册表：中心名称/项目编号/CRA 的独立配置数据，持久化；目录创建、递交矩阵、上传弹窗等全系统中心选项的唯一数据源 */
  centers: Center[]
  /** 项目编号 → 项目经理姓名映射（首页 PM 分配模块维护，全局 PM 列联动） */
  pmMap: Record<string, string>
  /** 后台管理：账户配置（登录校验、激活/冻结/关闭、重置密码） */
  accounts: Account[]
  /** 累计被删除的账号数（用于「累计开通」统计） */
  accountDeleted: number
  /** 后台管理：客户（申办方）列表 */
  customers: Customer[]
  /** 后台管理：用户登录日志（最新在前） */
  loginLogs: LoginLog[]
  /** R39 命名范式骨架库（admin 维护语法，PM 选用绑定；系统配置不受 DEMO_MODE 影响） */
  namingTemplates: NamingTemplate[]
  /** R39 文档类型字典（admin 维护） */
  docTypes: DocType[]
  /** R39 命名审计日志（创建命名 + displayFilename 修改） */
  namingLogs: NamingLog[]
}

/* ================= 账号体系 ================= */

export interface Account {
  id: string
  username: string
  password: string
  role: Role
  name: string
  title: string
  /** 执行人员所属研究中心；PM/admin 为空 */
  center?: string
  /** 关联申办方（外部账号）；内部员工为空 */
  sponsor?: string
  email?: string
  /** 联系方式 */
  phone?: string
  /** 账号状态：激活（默认，使用中）/ 冻结（临时禁用）/ 关闭（终止使用） */
  status: '激活' | '冻结' | '关闭'
  createdAt: string
  /** 最近一次登录时间（YYYY-MM-DD HH:mm） */
  lastLogin?: string
}

/** 登录日志（后台「登录趋势」） */
export interface LoginLog {
  id: string
  username: string
  name: string
  role: Role
  /** YYYY-MM-DD HH:mm */
  time: string
}

/** 客户（申办方） */
export interface Customer {
  id: string
  name: string
  contact: string
  phone: string
  /** 合作项目编号 */
  projects: string[]
  status: '合作中' | '暂停' | '已结束'
  createdAt: string
  note?: string
}

export const seedAccounts: Account[] = [
  { id: 'acc1', username: 'admin', password: '123456', role: 'admin', name: '系统管理员', title: 'ADMIN', status: '激活', createdAt: '2026-01-01', email: 'admin@clinx.cn', phone: '135-0000-0001' },
  { id: 'acc2', username: 'shilei', password: '123456', role: 'pm', name: '石磊', title: '主任医师', status: '激活', createdAt: '2026-02-10', email: 'shilei@clinx.cn', phone: '138-0110-2233', lastLogin: '2026-07-20 09:12' },
  { id: 'acc3', username: 'zhanglan', password: '123456', role: 'executor', name: '张兰', title: 'CRA', center: '上海瑞金医院', status: '激活', createdAt: '2026-03-01', email: 'zhanglan@clinx.cn', phone: '139-1024-5566', lastLogin: '2026-07-20 08:47' },
  { id: 'acc4', username: 'lihua', password: '123456', role: 'executor', name: '李华', title: 'CRA', center: '北京协和医院', status: '激活', createdAt: '2026-03-05', email: 'lihua@clinx.cn', phone: '137-8890-1122', lastLogin: '2026-07-19 16:22' },
  { id: 'acc5', username: 'wangjin', password: '123456', role: 'executor', name: '王金', title: 'CRA', center: '江苏大学附属医院', status: '冻结', createdAt: '2026-04-12', email: 'wangjin@clinx.cn', phone: '136-5544-7788' },
]

/** 兼容旧引用（登录页已改为读 store.state.accounts） */
export const ACCOUNTS = seedAccounts

/** 客户种子 */
export const seedCustomers: Customer[] = [
  { id: 'cu1', name: '恒瑞医药', contact: '陈立', phone: '138-0001-6688', projects: ['ON101CL103', 'ON101CL01'], status: '合作中', createdAt: '2025-11-20', note: '抗肿瘤管线重点客户' },
  { id: 'cu2', name: '百济神州', contact: '赵敏', phone: '139-2210-3355', projects: ['ON102CL201', 'ON102CL01'], status: '合作中', createdAt: '2026-01-15' },
  { id: 'cu3', name: '信达生物', contact: '孙鹏', phone: '137-5566-9021', projects: ['ON103CL301'], status: '合作中', createdAt: '2026-04-02' },
  { id: 'cu4', name: '复星医药', contact: '周婷', phone: '136-8890-1274', projects: [], status: '暂停', createdAt: '2026-05-18', note: '合同续签洽谈中' },
]

/** 登录日志种子：近 14 天的演示记录（最新在前） */
function buildSeedLoginLogs(): LoginLog[] {
  const names: { username: string; name: string; role: Role }[] = [
    { username: 'shilei', name: '石磊', role: 'pm' },
    { username: 'zhanglan', name: '张兰', role: 'executor' },
    { username: 'lihua', name: '李华', role: 'executor' },
    { username: 'admin', name: '系统管理员', role: 'admin' },
  ]
  const logs: LoginLog[] = []
  let n = 0
  const now = new Date()
  for (let d = 13; d >= 0; d--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d)
    const day = date.getDay()
    /* 周末登录少，工作日多；用确定性伪随机让图表有起伏 */
    const base = day === 0 || day === 6 ? 1 : 2 + ((d * 7) % 3)
    for (let i = 0; i < base + 1; i++) {
      const who = names[(d + i) % names.length]
      const hh = 8 + ((d * 5 + i * 3) % 10)
      const mm = (d * 11 + i * 17) % 60
      const pad = (v: number) => String(v).padStart(2, '0')
      logs.push({
        id: `log-seed-${n++}`,
        ...who,
        time: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(hh)}:${pad(mm)}`,
      })
    }
  }
  return logs.sort((a, b) => b.time.localeCompare(a.time))
}
export const seedLoginLogs: LoginLog[] = buildSeedLoginLogs()

const AUTH_KEY = 'clinx-auth'

function readAuth(): { authed: boolean; role: Role } {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { role?: string }
      if (parsed.role === 'pm' || parsed.role === 'executor' || parsed.role === 'admin') {
        return { authed: true, role: parsed.role }
      }
    }
  } catch {
    /* sessionStorage 不可用时按未登录处理 */
  }
  return { authed: false, role: 'pm' }
}

/* ================= 工具 ================= */

export const PM_USER = { name: '石磊', title: '主任医师', badge: 'PM' }
export const EX_USER = { name: '张兰', title: 'CRA', badge: 'CRA' }
export const ADMIN_USER = { name: '系统管理员', title: 'ADMIN', badge: 'ADMIN' }
/** 执行人员可见性：张兰 / ON101 / 上海瑞金医院 */
export const EXECUTOR_NAME = '张兰'
export const EXECUTOR_CENTER = '上海瑞金医院'

/** 各研究中心的临床监查员（CRA）种子；演示范本统一为「王金」，可在首页 CRA 分配模块调整 */
export const CENTER_CRA: Record<string, string> = {
  上海瑞金医院: '王金',
  江苏大学附属医院: '王金',
}
/** CRA 分配键：项目编号 + 研究中心 双维度；无项目编号时退化为仅中心（R32 起仅旧数据迁移使用） */
export const craKeyOf = (center: string, projectNo?: string) =>
  projectNo ? `${projectNo}|${center}` : center
/** 查询某中心（可指定项目）的临床监查员：优先「项目|中心」精确匹配，回退中心级配置，最后回退范本姓名（遗留：仅迁移用） */
export const craOfCenter = (craMap: Record<string, string>, center: string, projectNo?: string) =>
  (projectNo ? craMap[craKeyOf(center, projectNo)] : undefined) ?? craMap[center] ?? '王金'

/** 项目编号前缀双向匹配（ON101 与 ON101CL103 互认；空串匹配一切） */
export const projPrefixMatch = (a: string, b: string) =>
  !a || !b || a === b || a.startsWith(b) || b.startsWith(a)

/** R32 起 CRA 列的唯一查询口：从研究中心注册表取临床监查员——优先「同项目 + 同名」精确匹配，
    回退同名任意项目的配置；注册表中不存在该中心返回 ''（调用处渲染为 —） */
export const craNameOf = (centers: Center[], center: string, projectNo?: string) =>
  (projectNo ? centers.find((c) => c.name === center && projPrefixMatch(c.projectNo, projectNo))?.cra : undefined) ??
  centers.find((c) => c.name === center)?.cra ??
  ''

/** R32 旧数据迁移：从 craMap（「项目|中心」复合键，值=CRA）+ 已有 SITE 目录（projectNo+center，CRA 留空）
    派生注册表，按「项目编号|中心名」去重；注册表已存在（persisted.centers）时不走此逻辑 */
function deriveCenters(craMap: Record<string, string>, catalogs: Catalog[]): Center[] {
  const map = new Map<string, Center>()
  for (const k of Object.keys(craMap)) {
    const [p, name] = k.includes('|') ? k.split('|') : ['', k]
    if (!name) continue
    map.set(`${p}|${name}`, { id: nextId('ct'), name, projectNo: p, cra: craMap[k] ?? '' })
  }
  for (const c of catalogs) {
    if (c.kind === 'site' && c.center) {
      const key = `${c.projectNo}|${c.center}`
      if (!map.has(key)) map.set(key, { id: nextId('ct'), name: c.center, projectNo: c.projectNo, cra: '' })
    }
  }
  return [...map.values()]
}

/** 各研究编号的项目经理（PM）；演示范本统一为「王金」，可在首页 PM 分配模块调整 */
export const PROJECT_PM: Record<string, string> = {
  ON101CL103: '王金',
  ON101CL01: '王金',
}
/** 查询某研究编号的项目经理，未配置时回退到范本姓名 */
export const pmOfProject = (pmMap: Record<string, string>, project: string) =>
  pmMap[project] ?? '王金'

export function todayStr() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${bytes}B`
}

let uid = 1000
export const nextId = (prefix: string) => `${prefix}-${++uid}`

/** R39：对外展示/下载用文件名——旧数据无 displayFilename 字段时兜底 = name（合规兜底口径） */
export const displayNameOf = (f: Pick<TmfFile, 'name' | 'displayFilename'>) => f.displayFilename ?? f.name

/* ================= 种子数据 ================= */

const seedCatalogs: Catalog[] = [
  /* ON101CL103 项目的 STUDY TMF 目录：PM Transfer 归档的目标文件夹 */
  {
    id: 'cat-st0',
    kind: 'study',
    name: 'ON101CL103 STUDY TMF',
    projectNo: 'ON101CL103',
    center: undefined,
    creator: PM_USER.name,
    createDate: '2026-01-12',
    updateDate: '2026-12-12',
    size: '0KB',
    status: '未完成',
  },
  ...studyFolders.map((f) => ({
    id: `cat-${f.id}`,
    kind: 'study' as const,
    name: f.name,
    projectNo: f.projectNo,
    center: undefined,
    creator: f.creator,
    createDate: f.createdAt,
    updateDate: f.updatedAt,
    size: f.size,
    status: f.status,
  })),
  ...siteFolders.map((f) => ({
    id: `cat-${f.id}`,
    kind: 'site' as const,
    name: f.name,
    projectNo: f.projectNo,
    center: f.name.split('—')[1] ?? '',
    creator: f.creator,
    createDate: f.createdAt,
    updateDate: f.updatedAt,
    size: f.size,
    status: f.status,
  })),
  /* 江苏大学附属医院的 SITE TMF 目录：该中心执行上传文件的归档目标 */
  {
    id: 'cat-si9',
    kind: 'site',
    name: 'ON101CLCT09–SITE TMF —江苏大学附属医院',
    projectNo: 'ON101CL01',
    center: '江苏大学附属医院',
    creator: '张兰',
    createDate: '2026-01-12',
    updateDate: '2026-12-12',
    size: '0KB',
    status: '未完成',
  },
  /* ===== ON102 / ON103 项目演示数据（多项目切换测试用） ===== */
  {
    id: 'cat-on102-st1',
    kind: 'study',
    name: 'ON102CL201 STUDY TMF',
    projectNo: 'ON102CL201',
    center: undefined,
    creator: PM_USER.name,
    createDate: '2026-03-02',
    updateDate: '2026-06-18',
    size: '388.6KM',
    status: '完成',
  },
  {
    id: 'cat-on102-st2',
    kind: 'study',
    name: 'ON102CLCT02 STUDY TMF',
    projectNo: 'ON102CL01',
    center: undefined,
    creator: PM_USER.name,
    createDate: '2026-03-05',
    updateDate: '2026-06-20',
    size: '0KB',
    status: '未完成',
  },
  {
    id: 'cat-on102-si1',
    kind: 'site',
    name: 'ON102CLCT01–SITE TMF —北京协和医院',
    projectNo: 'ON102CL01',
    center: '北京协和医院',
    creator: '李华',
    createDate: '2026-03-08',
    updateDate: '2026-06-15',
    size: '188.2KM',
    status: '未完成',
  },
  {
    id: 'cat-on102-si2',
    kind: 'site',
    name: 'ON102CLCT03–SITE TMF —上海瑞金医院',
    projectNo: 'ON102CL01',
    center: '上海瑞金医院',
    creator: '张兰',
    createDate: '2026-03-10',
    updateDate: '2026-06-18',
    size: '210.5KM',
    status: '未完成',
  },
  {
    id: 'cat-on103-st1',
    kind: 'study',
    name: 'ON103CL301 STUDY TMF',
    projectNo: 'ON103CL301',
    center: undefined,
    creator: PM_USER.name,
    createDate: '2026-05-06',
    updateDate: '2026-06-28',
    size: '256.0KM',
    status: '未完成',
  },
  {
    id: 'cat-on103-st2',
    kind: 'study',
    name: 'ON103CL302 STUDY TMF',
    projectNo: 'ON103CL302',
    center: undefined,
    creator: PM_USER.name,
    createDate: '2026-05-10',
    updateDate: '2026-07-02',
    size: '0KB',
    status: '未完成',
  },
  {
    id: 'cat-on103-si1',
    kind: 'site',
    name: 'ON103CLCT01–SITE TMF —广州中山医院',
    projectNo: 'ON103CL301',
    center: '广州中山医院',
    creator: '李华',
    createDate: '2026-05-12',
    updateDate: '2026-06-25',
    size: '188.2KM',
    status: '未完成',
  },
  {
    id: 'cat-on103-si2',
    kind: 'site',
    name: 'ON103CLCT02–SITE TMF —上海瑞金医院',
    projectNo: 'ON103CL301',
    center: '上海瑞金医院',
    creator: '张兰',
    createDate: '2026-05-15',
    updateDate: '2026-06-30',
    size: '210.5KM',
    status: '未完成',
  },
]

const seedFiles: TmfFile[] = [
  // 执行端待提交（已上传未提交）
  { id: 'f1', name: 'ON101–伦理递交信–20250112', kind: 'folder', projectNo: 'ON101CL103', center: EXECUTOR_CENTER, uploader: EXECUTOR_NAME, uploadDate: '2026-12-12', size: '193.1KM', status: 'uploaded' },
  { id: 'f2', name: 'ON101–伦理递交信–20250112', kind: 'pdf', projectNo: 'ON101CL103', center: EXECUTOR_CENTER, uploader: EXECUTOR_NAME, uploadDate: '2026-12-12', size: '193.1KM', status: 'uploaded' },
  // 已提交待审核（同步到 PM 文件审核页）
  { id: 'f3', name: 'ON101–伦理递交信–上海瑞金医院–20250112', kind: 'pdf', projectNo: 'ON101CL01', center: EXECUTOR_CENTER, uploader: EXECUTOR_NAME, uploadDate: '2026-10-12', size: '193.1KM', status: 'pending' },
  { id: 'f4', name: 'ON101–知情同意书–1.0–20250602', kind: 'pdf', projectNo: 'ON101CL01', center: '江苏大学附属医院', uploader: EXECUTOR_NAME, uploadDate: '2026-09-11', size: '256.4KM', status: 'pending' },
  // 已驳回（保留在执行端列表，含驳回原因）
  { id: 'f5', name: 'ON101–研究者手册–1.0–20250602', kind: 'pdf', projectNo: 'ON101CL01', center: EXECUTOR_CENTER, uploader: EXECUTOR_NAME, uploadDate: '2026-08-10', size: '312.8KM', status: 'rejected', reason: '文件命名不规范，请按「项目–文件–版本–日期」格式修改后重新上传' },
  // 已归档（进入 SITE TMF 文件夹钻取视图）
  { id: 'f6', name: 'ON101–伦理批件–上海瑞金医院–20250110', kind: 'pdf', projectNo: 'ON101CL01', center: EXECUTOR_CENTER, uploader: EXECUTOR_NAME, uploadDate: '2026-07-08', size: '188.2KM', status: 'archived', folderId: 'cat-si3' },
  { id: 'f7', name: 'ON101–试验方案–2.0–20250301', kind: 'pdf', projectNo: 'ON101CL01', center: EXECUTOR_CENTER, uploader: EXECUTOR_NAME, uploadDate: '2026-11-05', size: '420.5KM', status: 'archived', folderId: 'cat-si3' },
  // 已归档至 STUDY TMF（SUBMISSION 上传渠道二「从 STUDY TMF 选择」的可选文件）
  { id: 'f12', name: 'ON101–研究方案–3.0–20250710', kind: 'pdf', projectNo: 'ON101CL01', center: EXECUTOR_CENTER, uploader: PM_USER.name, uploadDate: '2026-07-10', size: '256.0KM', status: 'archived', folderId: 'cat-st1' },
  { id: 'f13', name: 'ON101–知情同意书–3.0–20250715', kind: 'pdf', projectNo: 'ON101CL01', center: EXECUTOR_CENTER, uploader: PM_USER.name, uploadDate: '2026-07-15', size: '132.6KM', status: 'archived', folderId: 'cat-st1' },
  { id: 'f14', name: 'ON101–研究者手册–3.0–20250718', kind: 'pdf', projectNo: 'ON101CL01', center: EXECUTOR_CENTER, uploader: PM_USER.name, uploadDate: '2026-07-18', size: '310.2KM', status: 'archived', folderId: 'cat-st2' },
  // PM 自己上传（跳过审核，直接归档）
  { id: 'f8', name: 'Study–TMF', kind: 'folder', projectNo: 'ON101CL103', center: EXECUTOR_CENTER, uploader: PM_USER.name, uploadDate: '2026-12-12', size: '193.1KM', status: 'uploaded' },
  { id: 'f9', name: 'Study–TMF', kind: 'pdf', projectNo: 'ON101CL103', center: EXECUTOR_CENTER, uploader: PM_USER.name, uploadDate: '2026-12-12', size: '193.1KM', status: 'uploaded' },
  // 执行人员提交的文件夹（REVIEW 中可打开查看内部文件）
  { id: 'f10', name: 'ON101–安全性报告–202506', kind: 'folder', projectNo: 'ON101CL01', center: EXECUTOR_CENTER, uploader: EXECUTOR_NAME, uploadDate: '2026-12-12', size: '356.2KM', status: 'pending' },
  { id: 'f10a', name: 'ON101–安全性报告–1.0–20250601', kind: 'pdf', projectNo: 'ON101CL01', center: EXECUTOR_CENTER, uploader: EXECUTOR_NAME, uploadDate: '2026-12-12', size: '210.4KM', status: 'pending', parentId: 'f10' },
  { id: 'f10b', name: 'ON101–安全性汇总分析–20250605', kind: 'pdf', projectNo: 'ON101CL01', center: EXECUTOR_CENTER, uploader: EXECUTOR_NAME, uploadDate: '2026-12-12', size: '145.8KM', status: 'pending', parentId: 'f10' },
  // PM 新建的传输文件夹（可命名、打开、内部上传）
  { id: 'f11', name: 'ON101–研究文档', kind: 'folder', projectNo: 'ON101CL103', center: EXECUTOR_CENTER, uploader: PM_USER.name, uploadDate: '2026-12-12', size: '0KB', status: 'uploaded' },
  { id: 'f11a', name: 'ON101–研究方案–3.0–20250710', kind: 'pdf', projectNo: 'ON101CL103', center: EXECUTOR_CENTER, uploader: PM_USER.name, uploadDate: '2026-12-12', size: '256.0KM', status: 'uploaded', parentId: 'f11' },
  /* ===== ON102 项目 ===== */
  // 已归档至 ON102 STUDY TMF
  { id: 'f20', name: 'ON102–试验方案–1.0–20260301', kind: 'pdf', projectNo: 'ON102CL201', center: '北京协和医院', uploader: PM_USER.name, uploadDate: '2026-03-02', size: '256.0KM', status: 'archived', folderId: 'cat-on102-st1' },
  { id: 'f21', name: 'ON102–知情同意书–1.0–20260310', kind: 'pdf', projectNo: 'ON102CL201', center: '北京协和医院', uploader: PM_USER.name, uploadDate: '2026-03-10', size: '132.6KM', status: 'archived', folderId: 'cat-on102-st1' },
  // 已归档至 ON102 SITE TMF（北京协和 / 上海瑞金）
  { id: 'f22', name: 'ON102–伦理批件–北京协和医院–20260315', kind: 'pdf', projectNo: 'ON102CL01', center: '北京协和医院', uploader: '李华', uploadDate: '2026-03-15', size: '188.2KM', status: 'archived', folderId: 'cat-on102-si1' },
  { id: 'f26', name: 'ON102–伦理批件–上海瑞金医院–20260318', kind: 'pdf', projectNo: 'ON102CL01', center: EXECUTOR_CENTER, uploader: EXECUTOR_NAME, uploadDate: '2026-03-18', size: '210.5KM', status: 'archived', folderId: 'cat-on102-si2' },
  // 待审核（PM REVIEW 可见；f25 执行端张兰亦可见）
  { id: 'f23', name: 'ON102–研究者手册–1.0–20260401', kind: 'pdf', projectNo: 'ON102CL01', center: '北京协和医院', uploader: '李华', uploadDate: '2026-04-01', size: '312.8KM', status: 'pending' },
  { id: 'f25', name: 'ON102–伦理递交信–上海瑞金医院–20260420', kind: 'pdf', projectNo: 'ON102CL01', center: EXECUTOR_CENTER, uploader: EXECUTOR_NAME, uploadDate: '2026-04-20', size: '193.1KM', status: 'pending' },
  // PM 已上传未归档
  { id: 'f24', name: 'ON102–安全性报告–202604', kind: 'pdf', projectNo: 'ON102CL01', center: '北京协和医院', uploader: PM_USER.name, uploadDate: '2026-04-25', size: '145.8KM', status: 'uploaded' },
  /* ===== ON103 项目 ===== */
  { id: 'f27', name: 'ON103–试验方案–1.0–20260506', kind: 'pdf', projectNo: 'ON103CL301', center: '广州中山医院', uploader: PM_USER.name, uploadDate: '2026-05-06', size: '256.0KM', status: 'archived', folderId: 'cat-on103-st1' },
  { id: 'f28', name: 'ON103–研究病历–1.0–20260612', kind: 'pdf', projectNo: 'ON103CL301', center: '广州中山医院', uploader: PM_USER.name, uploadDate: '2026-06-12', size: '98.4KM', status: 'uploaded' },
  { id: 'f29', name: 'ON103–知情同意书–1.0–20260510', kind: 'pdf', projectNo: 'ON103CL301', center: '广州中山医院', uploader: PM_USER.name, uploadDate: '2026-05-10', size: '132.6KM', status: 'archived', folderId: 'cat-on103-st1' },
  // 已归档至 ON103 SITE TMF（广州中山 / 上海瑞金）
  { id: 'f30', name: 'ON103–伦理批件–广州中山医院–20260515', kind: 'pdf', projectNo: 'ON103CL301', center: '广州中山医院', uploader: '李华', uploadDate: '2026-05-15', size: '188.2KM', status: 'archived', folderId: 'cat-on103-si1' },
  { id: 'f31', name: 'ON103–伦理批件–上海瑞金医院–20260520', kind: 'pdf', projectNo: 'ON103CL301', center: EXECUTOR_CENTER, uploader: EXECUTOR_NAME, uploadDate: '2026-05-20', size: '210.5KM', status: 'archived', folderId: 'cat-on103-si2' },
  // 待审核（PM REVIEW 可见；f33 执行端张兰亦可见）
  { id: 'f32', name: 'ON103–研究者手册–1.0–20260601', kind: 'pdf', projectNo: 'ON103CL301', center: '广州中山医院', uploader: '李华', uploadDate: '2026-06-01', size: '312.8KM', status: 'pending' },
  { id: 'f33', name: 'ON103–伦理递交信–上海瑞金医院–20260608', kind: 'pdf', projectNo: 'ON103CL301', center: EXECUTOR_CENTER, uploader: EXECUTOR_NAME, uploadDate: '2026-06-08', size: '193.1KM', status: 'pending' },
]

const seedSubmissions: Submission[] = submissionFiles.map((f, i) => ({
  id: f.id,
  topic: f.topic,
  fileName: f.file,
  kind: f.kind,
  projectNo: f.projectNo,
  uploadDate: f.uploadDate,
  size: f.size,
  // sf1 / sf3 已发布（执行端可见），sf2 / sf4 待发布；ON102 新增条目按 mock 的 published 字段
  published: f.published || i === 0 || i === 2,
}))

/** 递交概况矩阵种子：瑞金医院（执行人员张兰所属中心）留空待录入，其余医院预填 */
const seedSubmissionSchedule: SubmissionScheduleRow[] = submissionOverviewRows.map((r, i) => ({
  id: `sr${i + 1}`,
  topic: r.topic,
  publishDate: r.publishDate,
  deadline: r.deadline,
  dates: Object.fromEntries(
    submissionHospitals.map((h, j) => [h, h === '瑞金医院' && i > 0 ? '' : r.dates[j]]),
  ),
}))

/** 收藏种子：两个已归档的具体文件 */
const seedFavorites: Record<string, string> = { f6: '2026-07-15', f7: '2026-07-16' }

/**
 * 演示数据开关：true 时首次启动加载种子演示数据；false 时系统从空白开始（仅保留登录账号）。
 * 当前处于正式测试阶段，全部业务数据（文件/目录/递交/收藏/CRA·PM 分配/客户/登录日志）默认清空。
 */
const DEMO_MODE = false

function initialState(): State {
  const auth = readAuth()
  const persisted = readData()
  const submissions = persisted?.submissions ?? (DEMO_MODE ? seedSubmissions : [])
  const baseSchedule = persisted?.submissionSchedule ?? (DEMO_MODE ? seedSubmissionSchedule : [])
  /* R29 老数据迁移：R29 之前发布的递交只翻 published 标志、概况矩阵无行——加载时对「已发布但矩阵缺行」
     的递交按递交记录派生补全（publishDate 回退为上传日期，deadline 取递交上的时限或空）。幂等：
     行 id = 递交 id，按 id 或主题匹配到既有行则跳过 */
  const derivedSchedule = submissions
    .filter((s) => s.published && !baseSchedule.some((r) => r.id === s.id || r.topic === s.topic))
    .map((s) => ({
      id: s.id,
      topic: s.topic,
      publishDate: s.uploadDate,
      deadline: s.deadline ?? '',
      dates: {} as Record<string, string>,
    }))
  const catalogs = persisted?.catalogs ?? (DEMO_MODE ? seedCatalogs : [])
  const craMap = persisted?.craMap ?? (DEMO_MODE ? { ...CENTER_CRA } : {})
  return {
    authed: auth.authed,
    role: auth.role,
    activeProject: '全部',
    files: persisted?.files ?? (DEMO_MODE ? seedFiles : []),
    catalogs,
    submissions,
    submissionSchedule: [...baseSchedule, ...derivedSchedule],
    /* 归档路由为系统配置：不受 DEMO_MODE 影响，无持久化时回退默认路由表 */
    archiveRoutes: persisted?.archiveRoutes ?? DEFAULT_ARCHIVE_ROUTES,
    /* 命名规则模板：系统配置，不受 DEMO_MODE 影响，无持久化时回退默认模板 */
    namingTemplate: persisted?.namingTemplate ?? DEFAULT_NAMING_TEMPLATE,
    favorites: persisted?.favorites ?? (DEMO_MODE ? seedFavorites : {}),
    craMap,
    /* R32 注册表迁移：持久化数据带 centers 字段直接用；否则从旧 craMap + 已有 SITE 目录派生去重（幂等，仅首启执行一次） */
    centers: persisted?.centers ?? deriveCenters(craMap, catalogs),
    pmMap: persisted?.pmMap ?? (DEMO_MODE ? { ...PROJECT_PM } : {}),
    accounts: (persisted?.accounts ?? seedAccounts).map((a) => {
      /* 旧版本状态迁移：启用→激活、停用→冻结；旧数据无密码字段 → 回退默认密码 123456 */
      const s = a.status as string
      return {
        ...a,
        password: a.password || '123456',
        status: (s === '启用' ? '激活' : s === '停用' ? '冻结' : s) as Account['status'],
      }
    }),
    accountDeleted: persisted?.accountDeleted ?? 0,
    customers: persisted?.customers ?? (DEMO_MODE ? seedCustomers : []),
    loginLogs: persisted?.loginLogs ?? (DEMO_MODE ? seedLoginLogs : []),
    /* R39：骨架库/字典为系统配置，不受 DEMO_MODE 影响；namingLogs 为审计数据，空白环境从空开始 */
    namingTemplates: persisted?.namingTemplates ?? DEFAULT_NAMING_TEMPLATES,
    docTypes: persisted?.docTypes ?? DEFAULT_DOC_TYPES,
    namingLogs: persisted?.namingLogs ?? [],
  }
}

/* ================= 本地持久化（localStorage） ================= */

/* v2：清空历史演示数据（旧 v1 数据保留在浏览器中但不再读取） */
const DATA_KEY = 'clinx-data-v2'

interface PersistedData {
  files: TmfFile[]
  catalogs: Catalog[]
  submissions: Submission[]
  submissionSchedule: SubmissionScheduleRow[]
  /** 归档路由表；旧版本持久化数据可能缺失，读取时回退默认路由 */
  archiveRoutes?: ArchiveRoute[]
  /** 命名规则模板；旧版本持久化数据可能缺失，读取时回退默认模板 */
  namingTemplate?: string
  /** 收藏映射；旧版本持久化数据可能缺失，读取时回退空对象 */
  favorites?: Record<string, string>
  /** CRA 分配映射（遗留字段；R32 起仅用于向 centers 迁移） */
  craMap?: Record<string, string>
  /** R32 研究中心注册表；旧版本持久化数据缺失时由 craMap + SITE 目录派生 */
  centers?: Center[]
  /** PM 分配映射；旧版本持久化数据可能缺失，读取时回退种子 */
  pmMap?: Record<string, string>
  /** 后台管理数据；旧版本持久化数据可能缺失，读取时回退种子 */
  accounts?: Account[]
  accountDeleted?: number
  customers?: Customer[]
  loginLogs?: LoginLog[]
  /** R39：骨架库/字典（缺失回退默认）与命名审计（缺失回退空） */
  namingTemplates?: NamingTemplate[]
  docTypes?: DocType[]
  namingLogs?: NamingLog[]
}

/** 读取持久化业务数据；损坏或字段缺失时回退种子数据 */
function readData(): PersistedData | null {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedData>
    if (
      !Array.isArray(parsed.files) ||
      !Array.isArray(parsed.catalogs) ||
      !Array.isArray(parsed.submissions) ||
      !Array.isArray(parsed.submissionSchedule)
    ) {
      return null
    }
    /* id 计数器推进到持久化数据中的最大值，避免刷新后新 id 冲突（R32：目录/注册表 id 同样占用计数器） */
    for (const f of [...parsed.files, ...parsed.catalogs, ...(parsed.centers ?? [])]) {
      const m = /-(\d+)$/.exec(f.id)
      if (m) uid = Math.max(uid, Number(m[1]))
    }
    return parsed as PersistedData
  } catch {
    return null
  }
}

/** 序列化持久化载荷（R35：写入守卫与跨标签同步共用） */
function serializeData(state: State): string {
  const data: PersistedData = {
    files: state.files,
    catalogs: state.catalogs,
    submissions: state.submissions,
    submissionSchedule: state.submissionSchedule,
    archiveRoutes: state.archiveRoutes,
    namingTemplate: state.namingTemplate,
    favorites: state.favorites,
    craMap: state.craMap,
    centers: state.centers,
    pmMap: state.pmMap,
    accounts: state.accounts,
    accountDeleted: state.accountDeleted,
    customers: state.customers,
    loginLogs: state.loginLogs,
    namingTemplates: state.namingTemplates,
    docTypes: state.docTypes,
    namingLogs: state.namingLogs,
  }
  return JSON.stringify(data)
}

/* ================= Reducer ================= */

export type Action =
  | { type: 'login'; role: Role; username?: string; name?: string }
  | { type: 'logout' }
  | { type: 'setRole'; role: Role }
  | { type: 'setActiveProject'; project: string }
  | { type: 'setNamingTemplate'; template: string }
  | { type: 'addFiles'; files: TmfFile[] }
  | { type: 'renameFile'; id: string; name: string }
  | { type: 'submitFiles'; ids: string[] }
  | { type: 'approveFile'; id: string }
  | { type: 'archiveFile'; id: string }
  /** PM TRANSFER 智能归档：按归档路由把文件归入 catalog/分区/文档类型 文件夹；分区文件夹不存在时随 newFolders 一并创建 */
  | { type: 'archiveRouted'; newFolders: TmfFile[]; entries: { id: string; folderId: string; parentId?: string }[] }
  | { type: 'addArchiveRoute'; route: ArchiveRoute }
  | { type: 'updateArchiveRoute'; id: string; patch: Partial<Omit<ArchiveRoute, 'id'>> }
  | { type: 'removeArchiveRoute'; id: string }
  | { type: 'rejectFile'; id: string; reason: string }
  | { type: 'reuploadFile'; id: string }
  | { type: 'removeFile'; id: string }
  | { type: 'removeFiles'; ids: string[] }
  | { type: 'setFileProject'; id: string; projectNo: string }
  | { type: 'addCatalogs'; catalogs: Catalog[] }
  /** R28 目录行内重命名（STUDY/SITE TMF 顶层目录列表）：改名持久化，引用处（钻取面包屑/钻取上传弹窗归属行）实时同步 */
  | { type: 'renameCatalog'; id: string; name: string }
  | { type: 'addSubmissions'; submissions: Submission[] }
  | { type: 'publishSubmission'; id: string }
  | { type: 'removeSubmission'; id: string }
  | { type: 'saveSubmissionDates'; updates: { rowId: string; hospital: string; date: string }[] }
  | { type: 'toggleFavorite'; id: string }
  | { type: 'assignCra'; center: string; cra: string; projectNo?: string }
  | { type: 'assignPm'; projectNo: string; pm: string }
  /* ===== R32 研究中心注册表 ===== */
  | { type: 'addCenter'; center: Center }
  /** 改名时级联：同项目 SITE 目录（center 字段 + 名称「—中心」后缀）、文件 center、递交矩阵日期键 同步更新 */
  | { type: 'updateCenter'; id: string; patch: Partial<Omit<Center, 'id'>> }
  | { type: 'removeCenter'; id: string }
  /* ===== R35 跨标签页同步：另一标签页写入 clinx-data-v2 后本标签页水合最新业务数据（保留会话态） ===== */
  | { type: 'hydrate'; data: PersistedData }
  | { type: 'addAccount'; account: Account }
  | { type: 'updateAccount'; id: string; patch: Partial<Omit<Account, 'id'>> }
  | { type: 'setAccountStatus'; id: string; status: Account['status'] }
  | { type: 'deleteAccount'; id: string }
  | { type: 'addCustomer'; customer: Customer }
  | { type: 'updateCustomer'; id: string; patch: Partial<Omit<Customer, 'id'>> }
  | { type: 'removeCustomer'; id: string }
  /* ===== R39 命名骨架库 / 文档类型字典 / 目录绑定 / 命名审计 ===== */
  | { type: 'addNamingTemplate'; template: NamingTemplate }
  | { type: 'updateNamingTemplate'; id: string; patch: Partial<Omit<NamingTemplate, 'id'>> }
  | { type: 'addDocType'; docType: DocType }
  | { type: 'updateDocType'; id: string; patch: Partial<Omit<DocType, 'id'>> }
  | { type: 'removeDocType'; id: string }
  /** PM 目录绑定/换绑/解绑（templateId=null 即解绑）；仅影响后续上传，存量文件名不动 */
  | { type: 'setFolderTemplate'; id: string; templateId: string | null }
  /** 追加命名审计日志（创建命名 / 修改 displayFilename） */
  | { type: 'addNamingLogs'; logs: NamingLog[] }
  /** PM 修改文件展示名：originalFilename 永不动，displayFilename 变更同事务写一条「修改文件名」审计 */
  | { type: 'renameDisplayFilename'; id: string; name: string; operator: string; role: Role }

/** 当前时间格式化为 YYYY-MM-DD HH:mm（登录日志用） */
export function nowStr() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 归档时自动分配目标文件夹：PM 上传 → 同项目编号的 STUDY TMF 目录；执行人员上传 → 匹配研究中心的 SITE 目录 */
function pickFolder(catalogs: Catalog[], file: TmfFile): string | undefined {
  if (file.uploader === PM_USER.name) {
    const byProject = catalogs.find((c) => c.kind === 'study' && c.projectNo === file.projectNo)
    if (byProject) return byProject.id
    const study = catalogs.find((c) => c.kind === 'study')
    if (study) return study.id
  }
  const byCenter = catalogs.find((c) => c.kind === 'site' && c.center === file.center)
  if (byCenter) return byCenter.id
  const anySite = catalogs.find((c) => c.kind === 'site')
  return anySite?.id
}

/** mock 文件大小形如 '193.1KM'，取数值部分（KB）累加后回写 */
function sumSizes(files: TmfFile[]): string {
  const kb = files.reduce((sum, f) => sum + (Number.parseFloat(f.size) || 0), 0)
  return `${kb.toFixed(1)}KM`
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'login': {
      /* 记录登录日志 + 回写账号最近登录时间 */
      const time = nowStr()
      const username = action.username ?? ''
      const name = action.name ?? username
      const log: LoginLog = { id: `log-${Date.now()}`, username, name, role: action.role, time }
      return {
        ...state,
        authed: true,
        role: action.role,
        loginLogs: [log, ...state.loginLogs].slice(0, 500),
        accounts: state.accounts.map((a) => (a.username === username ? { ...a, lastLogin: time } : a)),
      }
    }
    case 'logout':
      return { ...state, authed: false }
    case 'setRole':
      return { ...state, role: action.role }
    case 'setActiveProject':
      return { ...state, activeProject: action.project }
    case 'setNamingTemplate':
      return { ...state, namingTemplate: action.template.trim() || DEFAULT_NAMING_TEMPLATE }
    case 'addFiles':
      return { ...state, files: [...state.files, ...action.files] }
    case 'renameFile':
      return {
        ...state,
        files: state.files.map((f) => (f.id === action.id ? { ...f, name: action.name } : f)),
      }
    case 'submitFiles':
      return {
        ...state,
        files: state.files.map((f) =>
          action.ids.includes(f.id) && f.status === 'uploaded' ? { ...f, status: 'pending' as const } : f,
        ),
      }
    case 'approveFile':
    case 'archiveFile': {
      const target = state.files.find((f) => f.id === action.id)
      if (!target) return state
      const folderId = target.folderId ?? pickFolder(state.catalogs, target)
      /* 级联：归档文件夹时，其子文件一并归档到同一目录 */
      const ids = new Set([action.id, ...state.files.filter((f) => f.parentId === action.id).map((f) => f.id)])
      const files = state.files.map((f) =>
        ids.has(f.id) ? { ...f, status: 'archived' as const, folderId, reason: undefined } : f,
      )
      /* 同步更新目标目录的大小与更新日期，驱动 TMF 管理统计实时变化 */
      const catalogs = state.catalogs.map((c) => {
        if (c.id !== folderId) return c
        const inside = files.filter((f) => f.folderId === c.id && f.status === 'archived' && f.kind !== 'folder')
        return { ...c, size: sumSizes(inside), updateDate: todayStr() }
      })
      return { ...state, files, catalogs }
    }
    case 'archiveRouted': {
      /* 智能归档：分区/文档类型文件夹随 newFolders 创建，entries 逐文件指定目标（子文件各自路由，不跟随父文件夹） */
      const byId = new Map(action.entries.map((e) => [e.id, e]))
      const files = [...state.files, ...action.newFolders].map((f) => {
        const e = byId.get(f.id)
        return e ? { ...f, status: 'archived' as const, folderId: e.folderId, parentId: e.parentId, reason: undefined } : f
      })
      /* 同步更新目标目录的大小与更新日期（分区/文档类型文件夹为 folder 不计入大小） */
      const catIds = new Set(action.entries.map((e) => e.folderId))
      const catalogs = state.catalogs.map((c) => {
        if (!catIds.has(c.id)) return c
        const inside = files.filter((f) => f.folderId === c.id && f.status === 'archived' && f.kind !== 'folder')
        return { ...c, size: sumSizes(inside), updateDate: todayStr() }
      })
      return { ...state, files, catalogs }
    }
    case 'addArchiveRoute':
      return { ...state, archiveRoutes: [...state.archiveRoutes, action.route] }
    case 'updateArchiveRoute':
      return {
        ...state,
        archiveRoutes: state.archiveRoutes.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      }
    case 'removeArchiveRoute':
      return { ...state, archiveRoutes: state.archiveRoutes.filter((r) => r.id !== action.id) }
    case 'rejectFile':
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id ? { ...f, status: 'rejected' as const, reason: action.reason } : f,
        ),
      }
    case 'reuploadFile':
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id ? { ...f, status: 'uploaded' as const, reason: undefined, uploadDate: todayStr() } : f,
        ),
      }
    case 'removeFile':
      /* 级联：删除文件夹时其子文件一并删除 */
      return { ...state, files: state.files.filter((f) => f.id !== action.id && f.parentId !== action.id) }
    case 'removeFiles': {
      const ids = new Set(action.ids)
      return { ...state, files: state.files.filter((f) => !ids.has(f.id) && !(f.parentId && ids.has(f.parentId))) }
    }
    case 'setFileProject':
      /* 级联：文件夹更换项目编号时，其子文件编号一并更新 */
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id || f.parentId === action.id ? { ...f, projectNo: action.projectNo } : f,
        ),
      }
    case 'addCatalogs':
      return { ...state, catalogs: [...state.catalogs, ...action.catalogs] }
    case 'renameCatalog':
      return {
        ...state,
        catalogs: state.catalogs.map((c) => (c.id === action.id ? { ...c, name: action.name } : c)),
      }
    case 'addSubmissions':
      return { ...state, submissions: [...state.submissions, ...action.submissions] }
    case 'publishSubmission': {
      const target = state.submissions.find((s) => s.id === action.id)
      /* R29 数据流修复：发布动作同步生成递交概况矩阵行（原实现只翻 published 标志，矩阵永远空白）。
         矩阵行 id 与递交 id 一致，删除/派生补全均以 id 对齐 */
      const hasRow =
        !target || state.submissionSchedule.some((r) => r.id === target.id || r.topic === target.topic)
      return {
        ...state,
        submissions: state.submissions.map((s) => (s.id === action.id ? { ...s, published: true } : s)),
        submissionSchedule: hasRow
          ? state.submissionSchedule
          : [
              ...state.submissionSchedule,
              {
                id: target.id,
                topic: target.topic,
                publishDate: todayStr(),
                deadline: target.deadline ?? '',
                dates: {},
              },
            ],
      }
    }
    case 'removeSubmission':
      /* R29：删除递交时同步移除概况矩阵行（行 id = 递交 id） */
      return {
        ...state,
        submissions: state.submissions.filter((s) => s.id !== action.id),
        submissionSchedule: state.submissionSchedule.filter((r) => r.id !== action.id),
      }
    case 'saveSubmissionDates':
      return {
        ...state,
        submissionSchedule: state.submissionSchedule.map((row) => {
          const patch = action.updates.filter((u) => u.rowId === row.id)
          if (patch.length === 0) return row
          const dates = { ...row.dates }
          for (const u of patch) dates[u.hospital] = u.date
          return { ...row, dates }
        }),
      }
    case 'toggleFavorite': {
      const favorites = { ...state.favorites }
      if (action.id in favorites) delete favorites[action.id]
      else favorites[action.id] = todayStr()
      return { ...state, favorites }
    }
    case 'assignCra':
      return {
        ...state,
        craMap: { ...state.craMap, [craKeyOf(action.center, action.projectNo)]: action.cra },
      }
    case 'assignPm':
      return { ...state, pmMap: { ...state.pmMap, [action.projectNo]: action.pm } }
    /* ===== R32 研究中心注册表 ===== */
    case 'addCenter':
      return { ...state, centers: [...state.centers, action.center] }
    case 'updateCenter': {
      const prev = state.centers.find((c) => c.id === action.id)
      if (!prev) return state
      const centers = state.centers.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c))
      const nextName = (action.patch.name ?? prev.name).trim()
      /* 仅改名触发级联；项目编号在 UI 层对已建目录中心禁用，这里不级联编号 */
      if (!nextName || nextName === prev.name) return { ...state, centers }
      const matchProj = (p: string) => projPrefixMatch(p, prev.projectNo)
      /* SITE 目录：center 字段 + 目录名后缀同步——兼容「 —中心名」（R32 前旧目录）与「-TMF-中心名」（R34 图纸命名）两种后缀 */
      const catalogs = state.catalogs.map((c) => {
        if (!(c.kind === 'site' && c.center === prev.name && matchProj(c.projectNo))) return c
        let name = c.name
        if (name.endsWith(`—${prev.name}`)) {
          name = `${name.slice(0, name.length - prev.name.length - 1)}—${nextName}`
        } else if (name.endsWith(`-TMF-${prev.name}`)) {
          name = `${name.slice(0, name.length - prev.name.length)}${nextName}`
        }
        return { ...c, center: nextName, name }
      })
      /* 在途/已归档文件的 center 字段同步（保持统计与归档口径一致） */
      const files = state.files.map((f) =>
        f.center === prev.name && matchProj(f.projectNo) ? { ...f, center: nextName } : f,
      )
      /* 递交概况矩阵 dates 以中心名为键：改名平移键（矩阵列按注册表名称渲染，键不同步则日期丢失） */
      const submissionSchedule = state.submissionSchedule.map((r) => {
        if (!(prev.name in r.dates)) return r
        const dates = { ...r.dates }
        dates[nextName] = dates[prev.name]
        delete dates[prev.name]
        return { ...r, dates }
      })
      return { ...state, centers, catalogs, files, submissionSchedule }
    }
    case 'removeCenter':
      /* 仅移除注册表配置；已建 SITE 目录与其中的文件保留（UI 层删除已建目录中心前有确认提示） */
      return { ...state, centers: state.centers.filter((c) => c.id !== action.id) }
    /* ===== R35 跨标签页水合：另一标签页（如 PM 端）发布递交/改动数据后，本标签页实时同步 ===== */
    case 'hydrate': {
      const d = action.data
      /* 已发布但矩阵缺行的递交派生补行（与 initialState 同一迁移规则，幂等） */
      const derived = d.submissions
        .filter((s) => s.published && !d.submissionSchedule.some((r) => r.id === s.id || r.topic === s.topic))
        .map((s) => ({
          id: s.id,
          topic: s.topic,
          publishDate: s.uploadDate,
          deadline: s.deadline ?? '',
          dates: {} as Record<string, string>,
        }))
      return {
        ...state,
        files: d.files,
        catalogs: d.catalogs,
        submissions: d.submissions,
        submissionSchedule: [...d.submissionSchedule, ...derived],
        archiveRoutes: d.archiveRoutes ?? state.archiveRoutes,
        namingTemplate: d.namingTemplate ?? state.namingTemplate,
        favorites: d.favorites ?? state.favorites,
        craMap: d.craMap ?? state.craMap,
        centers: d.centers ?? state.centers,
        pmMap: d.pmMap ?? state.pmMap,
        accounts: d.accounts ?? state.accounts,
        accountDeleted: d.accountDeleted ?? state.accountDeleted,
        customers: d.customers ?? state.customers,
        loginLogs: d.loginLogs ?? state.loginLogs,
        namingTemplates: d.namingTemplates ?? state.namingTemplates,
        docTypes: d.docTypes ?? state.docTypes,
        namingLogs: d.namingLogs ?? state.namingLogs,
      }
    }
    /* ===== 后台管理：账户配置 ===== */
    case 'addAccount':
      return { ...state, accounts: [...state.accounts, action.account] }
    case 'updateAccount':
      return {
        ...state,
        accounts: state.accounts.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)),
      }
    case 'setAccountStatus':
      return {
        ...state,
        accounts: state.accounts.map((a) => (a.id === action.id ? { ...a, status: action.status } : a)),
      }
    case 'deleteAccount':
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.id),
        accountDeleted: state.accountDeleted + 1,
      }
    /* ===== 后台管理：客户管理 ===== */
    case 'addCustomer':
      return { ...state, customers: [...state.customers, action.customer] }
    case 'updateCustomer':
      return {
        ...state,
        customers: state.customers.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      }
    case 'removeCustomer':
      return { ...state, customers: state.customers.filter((c) => c.id !== action.id) }
    /* ===== R39 命名骨架库 / 字典 / 目录绑定 / 审计 ===== */
    case 'addNamingTemplate':
      return { ...state, namingTemplates: [...state.namingTemplates, action.template] }
    case 'updateNamingTemplate':
      return {
        ...state,
        namingTemplates: state.namingTemplates.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      }
    case 'addDocType':
      return { ...state, docTypes: [...state.docTypes, action.docType] }
    case 'updateDocType':
      return {
        ...state,
        docTypes: state.docTypes.map((d) => (d.id === action.id ? { ...d, ...action.patch } : d)),
      }
    case 'removeDocType':
      return { ...state, docTypes: state.docTypes.filter((d) => d.id !== action.id) }
    case 'setFolderTemplate':
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id
            ? action.templateId
              ? { ...f, namingTemplateId: action.templateId }
              : { ...f, namingTemplateId: undefined }
            : f,
        ),
      }
    case 'addNamingLogs':
      /* 审计日志只增不改；上限 2000 条防无限膨胀 */
      return { ...state, namingLogs: [...action.logs, ...state.namingLogs].slice(0, 2000) }
    case 'renameDisplayFilename': {
      const target = state.files.find((f) => f.id === action.id)
      if (!target || target.kind === 'folder') return state
      const oldValue = target.displayFilename ?? target.name
      if (oldValue === action.name) return state
      const log: NamingLog = {
        id: nextId('nl'),
        fileId: target.id,
        operator: action.operator,
        time: nowStr(),
        action: '修改文件名',
        oldValue,
        newValue: action.name,
        projectNo: target.projectNo,
        role: action.role,
        originalFilename: target.originalFilename,
      }
      return {
        ...state,
        files: state.files.map((f) => (f.id === action.id ? { ...f, displayFilename: action.name } : f)),
        namingLogs: [log, ...state.namingLogs].slice(0, 2000),
      }
    }
  }
}

/* ================= Context / Hooks ================= */

const StoreContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const value = useMemo(() => ({ state, dispatch }), [state])
  /* R35：最近一次写入/水合的序列化内容——写入守卫与 storage 监听防回环共用 */
  const lastSerialized = useRef('')

  /* 登录态持久化到 sessionStorage：刷新不掉线，关标签页失效 */
  useEffect(() => {
    try {
      if (state.authed) sessionStorage.setItem(AUTH_KEY, JSON.stringify({ role: state.role }))
      else sessionStorage.removeItem(AUTH_KEY)
    } catch {
      /* 忽略持久化失败 */
    }
  }, [state.authed, state.role])

  /* 业务数据持久化到 localStorage：刷新/重开浏览器不丢失；
     R35 守卫：与最近一次写入/水合内容一致时跳过，配合下方 storage 监听杜绝跨标签页回环写 */
  useEffect(() => {
    try {
      const raw = serializeData(state)
      if (raw === lastSerialized.current) return
      lastSerialized.current = raw
      localStorage.setItem(DATA_KEY, raw)
    } catch {
      /* 存储满或不可用时静默失败，不影响内存态 */
    }
  }, [state.files, state.catalogs, state.submissions, state.submissionSchedule, state.archiveRoutes, state.namingTemplate, state.favorites, state.craMap, state.centers, state.pmMap, state.accounts, state.accountDeleted, state.customers, state.loginLogs, state.namingTemplates, state.docTypes, state.namingLogs])

  /* R35 跨标签页同步：其他标签页写入 clinx-data-v2 时本标签页即时水合最新业务数据
     （保留本会话的登录态/角色/项目筛选；storage 事件只在本标签页之外触发，不会自环） */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DATA_KEY || !e.newValue) return
      if (e.newValue === lastSerialized.current) return
      lastSerialized.current = e.newValue
      const data = readData()
      if (data) dispatch({ type: 'hydrate', data })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

/* ================= 派生统计 ================= */

export interface CenterStat {
  center: string
  uploaded: number
  pending: number
  rejected: number
  archived: number
}

/** 按研究中心聚合文件计数（用于 文件状态 / 传输概况 表；文件夹内的子文件不重复计数） */
export function statsByCenter(files: TmfFile[]): CenterStat[] {
  const map = new Map<string, CenterStat>()
  for (const f of files) {
    if (f.parentId) continue
    const row = map.get(f.center) ?? { center: f.center, uploaded: 0, pending: 0, rejected: 0, archived: 0 }
    row.uploaded += 1
    if (f.status === 'pending') row.pending += 1
    if (f.status === 'rejected') row.rejected += 1
    if (f.status === 'archived') row.archived += 1
    map.set(f.center, row)
  }
  return [...map.values()]
}

export interface ProjectStat {
  project: string
  uploaded: number
  archived: number
}

/** 按项目编号聚合（用于 Transfer 文件状态表；子文件不重复计数） */
export function statsByProject(files: TmfFile[]): ProjectStat[] {
  const map = new Map<string, ProjectStat>()
  for (const f of files) {
    if (f.parentId) continue
    const row = map.get(f.projectNo) ?? { project: f.projectNo, uploaded: 0, archived: 0 }
    row.uploaded += 1
    if (f.status === 'archived') row.archived += 1
    map.set(f.projectNo, row)
  }
  return [...map.values()]
}
