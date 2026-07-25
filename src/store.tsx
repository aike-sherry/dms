import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react'
import { studyFolders, siteFolders, submissionFiles, submissionHospitals, submissionOverviewRows } from '@/data/mock'

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
}

/** 递交概况矩阵行：每家医院的递交日期由执行人员录入，dates 以医院名为键 */
export interface SubmissionScheduleRow {
  id: string
  topic: string
  publishDate: string
  deadline: string
  dates: Record<string, string>
}

export interface State {
  authed: boolean
  role: Role
  /** 全局项目筛选（顶部 Header 下拉）；'全部' 表示不过滤，仅会话内状态不持久化 */
  activeProject: string
  files: TmfFile[]
  catalogs: Catalog[]
  submissions: Submission[]
  submissionSchedule: SubmissionScheduleRow[]
  /** 收藏：文件 id → 收藏日期（仅具体文件可收藏，文件夹不可） */
  favorites: Record<string, string>
  /** 研究中心 → CRA 姓名映射（首页 CRA 分配模块维护，全局 CRA 列联动） */
  craMap: Record<string, string>
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
/** CRA 分配键：项目编号 + 研究中心 双维度；无项目编号时退化为仅中心 */
export const craKeyOf = (center: string, projectNo?: string) =>
  projectNo ? `${projectNo}|${center}` : center
/** 查询某中心（可指定项目）的临床监查员：优先「项目|中心」精确匹配，回退中心级配置，最后回退范本姓名 */
export const craOfCenter = (craMap: Record<string, string>, center: string, projectNo?: string) =>
  (projectNo ? craMap[craKeyOf(center, projectNo)] : undefined) ?? craMap[center] ?? '王金'

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
  return {
    authed: auth.authed,
    role: auth.role,
    activeProject: '全部',
    files: persisted?.files ?? (DEMO_MODE ? seedFiles : []),
    catalogs: persisted?.catalogs ?? (DEMO_MODE ? seedCatalogs : []),
    submissions: persisted?.submissions ?? (DEMO_MODE ? seedSubmissions : []),
    submissionSchedule: persisted?.submissionSchedule ?? (DEMO_MODE ? seedSubmissionSchedule : []),
    favorites: persisted?.favorites ?? (DEMO_MODE ? seedFavorites : {}),
    craMap: persisted?.craMap ?? (DEMO_MODE ? { ...CENTER_CRA } : {}),
    pmMap: persisted?.pmMap ?? (DEMO_MODE ? { ...PROJECT_PM } : {}),
    accounts: (persisted?.accounts ?? seedAccounts).map((a) => {
      /* 旧版本状态迁移：启用→激活、停用→冻结 */
      const s = a.status as string
      return { ...a, status: (s === '启用' ? '激活' : s === '停用' ? '冻结' : s) as Account['status'] }
    }),
    accountDeleted: persisted?.accountDeleted ?? 0,
    customers: persisted?.customers ?? (DEMO_MODE ? seedCustomers : []),
    loginLogs: persisted?.loginLogs ?? (DEMO_MODE ? seedLoginLogs : []),
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
  /** 收藏映射；旧版本持久化数据可能缺失，读取时回退空对象 */
  favorites?: Record<string, string>
  /** CRA 分配映射；旧版本持久化数据可能缺失，读取时回退种子 */
  craMap?: Record<string, string>
  /** PM 分配映射；旧版本持久化数据可能缺失，读取时回退种子 */
  pmMap?: Record<string, string>
  /** 后台管理数据；旧版本持久化数据可能缺失，读取时回退种子 */
  accounts?: Account[]
  accountDeleted?: number
  customers?: Customer[]
  loginLogs?: LoginLog[]
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
    /* id 计数器推进到持久化数据中的最大值，避免刷新后新 id 冲突 */
    for (const f of parsed.files) {
      const m = /-(\d+)$/.exec(f.id)
      if (m) uid = Math.max(uid, Number(m[1]))
    }
    return parsed as PersistedData
  } catch {
    return null
  }
}

function writeData(state: State) {
  try {
    const data: PersistedData = {
      files: state.files,
      catalogs: state.catalogs,
      submissions: state.submissions,
      submissionSchedule: state.submissionSchedule,
      favorites: state.favorites,
      craMap: state.craMap,
      pmMap: state.pmMap,
      accounts: state.accounts,
      accountDeleted: state.accountDeleted,
      customers: state.customers,
      loginLogs: state.loginLogs,
    }
    localStorage.setItem(DATA_KEY, JSON.stringify(data))
  } catch {
    /* 存储满或不可用时静默失败，不影响内存态 */
  }
}

/* ================= Reducer ================= */

export type Action =
  | { type: 'login'; role: Role; username?: string; name?: string }
  | { type: 'logout' }
  | { type: 'setRole'; role: Role }
  | { type: 'setActiveProject'; project: string }
  | { type: 'addFiles'; files: TmfFile[] }
  | { type: 'renameFile'; id: string; name: string }
  | { type: 'submitFiles'; ids: string[] }
  | { type: 'approveFile'; id: string }
  | { type: 'archiveFile'; id: string }
  | { type: 'rejectFile'; id: string; reason: string }
  | { type: 'reuploadFile'; id: string }
  | { type: 'removeFile'; id: string }
  | { type: 'removeFiles'; ids: string[] }
  | { type: 'setFileProject'; id: string; projectNo: string }
  | { type: 'addCatalogs'; catalogs: Catalog[] }
  | { type: 'addSubmissions'; submissions: Submission[] }
  | { type: 'publishSubmission'; id: string }
  | { type: 'removeSubmission'; id: string }
  | { type: 'saveSubmissionDates'; updates: { rowId: string; hospital: string; date: string }[] }
  | { type: 'toggleFavorite'; id: string }
  | { type: 'assignCra'; center: string; cra: string; projectNo?: string }
  | { type: 'assignPm'; projectNo: string; pm: string }
  | { type: 'addAccount'; account: Account }
  | { type: 'updateAccount'; id: string; patch: Partial<Omit<Account, 'id'>> }
  | { type: 'setAccountStatus'; id: string; status: Account['status'] }
  | { type: 'deleteAccount'; id: string }
  | { type: 'addCustomer'; customer: Customer }
  | { type: 'updateCustomer'; id: string; patch: Partial<Omit<Customer, 'id'>> }
  | { type: 'removeCustomer'; id: string }

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
    case 'addSubmissions':
      return { ...state, submissions: [...state.submissions, ...action.submissions] }
    case 'publishSubmission':
      return {
        ...state,
        submissions: state.submissions.map((s) => (s.id === action.id ? { ...s, published: true } : s)),
      }
    case 'removeSubmission':
      return { ...state, submissions: state.submissions.filter((s) => s.id !== action.id) }
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
  }
}

/* ================= Context / Hooks ================= */

const StoreContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const value = useMemo(() => ({ state, dispatch }), [state])

  /* 登录态持久化到 sessionStorage：刷新不掉线，关标签页失效 */
  useEffect(() => {
    try {
      if (state.authed) sessionStorage.setItem(AUTH_KEY, JSON.stringify({ role: state.role }))
      else sessionStorage.removeItem(AUTH_KEY)
    } catch {
      /* 忽略持久化失败 */
    }
  }, [state.authed, state.role])

  /* 业务数据持久化到 localStorage：刷新/重开浏览器不丢失 */
  useEffect(() => {
    writeData(state)
  }, [state.files, state.catalogs, state.submissions, state.submissionSchedule, state.favorites, state.craMap, state.pmMap, state.accounts, state.accountDeleted, state.customers, state.loginLogs])

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
