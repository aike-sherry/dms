// 临床研究文件管理系统（TMF/eDMS）项目经理端 —— 全部 mock 数据

/* ---------- 通用 ---------- */

export interface SelectOption {
  label: string
  value: string
}

export const projectOptions: SelectOption[] = [
  { label: 'ON101', value: 'ON101' },
  { label: 'ON102', value: 'ON102' },
  { label: 'ON103', value: 'ON103' },
]

export const headerProjectOptions: SelectOption[] = [
  { label: 'ON101CLCT06', value: 'ON101CLCT06' },
  { label: 'ON101CLCT07', value: 'ON101CLCT07' },
  { label: 'ON102CLCT01', value: 'ON102CLCT01' },
]

export const siteOptions: SelectOption[] = [
  { label: '上海瑞金医院', value: '上海瑞金医院' },
  { label: '江苏大学附属医院', value: '江苏大学附属医院' },
  { label: '中山医院', value: '中山医院' },
]

/* ---------- Home 首页 ---------- */

export interface DonutDatum {
  name: string
  value: number
  color: string
}

export const studyDonutData: DonutDatum[] = [
  { name: '上传', value: 35, color: '#3b82f6' },
  { name: '归档', value: 65, color: '#14b8a6' },
]

export type StatIconKey = 'upload' | 'scan' | 'filex' | 'archive'

export interface SiteStatCard {
  label: string
  value: number
  color: string
  icon: StatIconKey
  trend: string
}

export const siteStatCards: SiteStatCard[] = [
  { label: '上传文件', value: 120, color: '#14b8a6', icon: 'upload', trend: '↑ 较上月增加5%' },
  { label: '待审核文件', value: 26, color: '#f97316', icon: 'scan', trend: '↑ 较上月增加5%' },
  { label: '驳回文件', value: 54, color: '#3b82f6', icon: 'filex', trend: '↑ 较上月增加5%' },
  { label: '归档文件', value: 67, color: '#8b5cf6', icon: 'archive', trend: '↑ 较上月增加5%' },
]

export interface MonthStat {
  month: string
  upload: number
  pending: number
  rejected: number
  archived: number
}

export const monthlyStats: MonthStat[] = [
  { month: '2015-01', upload: 20, pending: 15, rejected: 10, archived: 7 },
  { month: '2015-02', upload: 18, pending: 30, rejected: 22, archived: 15 },
  { month: '2015-03', upload: 25, pending: 13, rejected: 7, archived: 5 },
  { month: '2015-04', upload: 12, pending: 22, rejected: 14, archived: 6 },
  { month: '2015-05', upload: 22, pending: 29, rejected: 6, archived: 15 },
  { month: '2015-06', upload: 15, pending: 21, rejected: 27, archived: 16 },
  { month: '2015-07', upload: 15, pending: 9, rejected: 17, archived: 8 },
]

export const barSeries = [
  { key: 'upload', name: '上传文件', color: '#14b8a6' },
  { key: 'pending', name: '待审核文件', color: '#f97316' },
  { key: 'rejected', name: '驳回文件', color: '#f43f5e' },
  { key: 'archived', name: '归档文件', color: '#8b5cf6' },
] as const

export interface HomeStudyRow {
  project: string
  upload: number
  archived: number
}

export const homeStudyRows: HomeStudyRow[] = [
  { project: 'ON101', upload: 55, archived: 20 },
  { project: 'ON102', upload: 45, archived: 20 },
  { project: 'ON103', upload: 55, archived: 20 },
]

export interface HomeSiteRow {
  site: string
  upload: number
  pending: number
  rejected: number
  archived: number
}

export const homeSiteRows: HomeSiteRow[] = [
  { site: '江苏大学附属医院', upload: 55, pending: 20, rejected: 18, archived: 20 },
  { site: '上海瑞金医院', upload: 45, pending: 15, rejected: 16, archived: 20 },
  { site: '中山医院', upload: 55, pending: 25, rejected: 45, archived: 20 },
]

/* ---------- STUDY / SITE TMF ---------- */

export interface TmfManageRow {
  name: string // 项目编号 或 研究中心
  uploaded: number
  reviewing: number
  approved: number
  archived: number
}

export const studyManageRows: TmfManageRow[] = [
  { name: 'ON101', uploaded: 55, reviewing: 20, approved: 18, archived: 20 },
  { name: 'ON102', uploaded: 45, reviewing: 15, approved: 16, archived: 20 },
]

export const siteManageRows: TmfManageRow[] = [
  { name: '江苏大学附属医院', uploaded: 55, reviewing: 20, approved: 18, archived: 20 },
  { name: '上海瑞金医院', uploaded: 45, reviewing: 15, approved: 16, archived: 20 },
]

export type FileKind = 'folder' | 'pdf'

export interface TmfFolder {
  id: string
  name: string
  projectNo: string
  createdAt: string
  creator: string
  updatedAt: string
  size: string
  status: '完成' | '未完成'
}

export const studyFolders: TmfFolder[] = [
  { id: 'st1', name: 'ON101CLCT06 STUDY TMF', projectNo: 'ON101CL01', createdAt: '2026-01-12', creator: '张兰', updatedAt: '2026-12-12', size: '193.1KM', status: '完成' },
  { id: 'st2', name: 'ON101CLCT05 STUDY TMF', projectNo: 'ON101CL01', createdAt: '2026-01-12', creator: '张兰', updatedAt: '2026-12-12', size: '193.1KM', status: '未完成' },
  { id: 'st3', name: 'ON101CLCT04 STUDY TMF', projectNo: 'ON101CL01', createdAt: '2026-01-12', creator: '张兰', updatedAt: '2026-12-12', size: '193.1KM', status: '完成' },
  { id: 'st4', name: 'ON101CLCT03STUDY TMF', projectNo: 'ON101CL01', createdAt: '2026-01-12', creator: '张兰', updatedAt: '2026-12-12', size: '193.1KM', status: '完成' },
]

export const siteFolders: TmfFolder[] = [
  { id: 'si1', name: 'ON101CLCT07–SITE TMF —上海中山医院', projectNo: 'ON101CL01', createdAt: '2026-01-12', creator: '张兰', updatedAt: '2026-12-12', size: '193.1KM', status: '完成' },
  { id: 'si2', name: 'ON101CLCT07–SITE TMF —上海中西结合医院', projectNo: 'ON101CL01', createdAt: '2026-01-12', creator: '张兰', updatedAt: '2026-12-12', size: '193.1KM', status: '未完成' },
  { id: 'si3', name: 'ON101CLCT07–SITE TMF —上海瑞金医院', projectNo: 'ON101CL01', createdAt: '2026-01-12', creator: '张兰', updatedAt: '2026-12-12', size: '193.1KM', status: '完成' },
  { id: 'si4', name: 'ON101CLCT07–SITE TMF —上海华山医院', projectNo: 'ON101CL01', createdAt: '2026-01-12', creator: '张兰', updatedAt: '2026-12-12', size: '193.1KM', status: '完成' },
]

export interface TmfSubFolder {
  id: string
  name: string
  projectNo: string
  createdAt: string
  creator: string
  updatedAt: string
  size: string
}

const subBase = { projectNo: 'ON101CL01', createdAt: '2026-01-12', creator: '张兰', updatedAt: '2026-12-12', size: '193.1KM' }

export const studySubFolders: TmfSubFolder[] = [
  { id: 'sub1', name: 'Study–TMF', ...subBase },
  { id: 'sub2', name: 'Study–TMF', ...subBase },
  { id: 'sub3', name: 'Study–TMF', ...subBase },
  { id: 'sub4', name: 'Study–TMF', ...subBase },
]

export const siteSubFolders: TmfSubFolder[] = [
  { id: 'sub1', name: 'Site–TMF', ...subBase },
  { id: 'sub2', name: 'Site–TMF', ...subBase },
  { id: 'sub3', name: 'Site–TMF', ...subBase },
  { id: 'sub4', name: 'Site–TMF', ...subBase },
]

/* 目录创建弹窗 */
export interface CatalogRow {
  id: string
  projectNo: string
  site?: string
  folderName: string
  isNew?: boolean
}

export const catalogStudyRows: CatalogRow[] = [
  { id: 'c1', projectNo: 'ON101', folderName: 'ON101CLK0912' },
  { id: 'c2', projectNo: 'ON102', folderName: 'ON101CLK0912' },
]

export const catalogSiteRows: CatalogRow[] = [
  { id: 'c1', projectNo: 'ON101', site: '上海瑞金医院', folderName: 'ON101CLCT07–SITE TMF —上海瑞金医院' },
  { id: 'c2', projectNo: 'ON102', site: '上海华山医院', folderName: 'ON101CLCT07–SITE TMF —上海华山医院' },
]

/* ---------- SUBMISSION ---------- */

export const submissionHospitals = ['瑞金医院', '中山医院', '华山医院', '南山医院']

export interface SubmissionOverviewRow {
  topic: string
  publishDate: string
  deadline: string
  dates: string[]
}

export const submissionOverviewRows: SubmissionOverviewRow[] = [
  { topic: '1.0版本方案递交', publishDate: '2025-02-12', deadline: '2025-02-12', dates: ['2025-02-12', '2025-02-12', '2025-02-12', '2025-02-12'] },
  { topic: '2.0版本方案递交', publishDate: '2025-02-12', deadline: '2025-02-12', dates: ['2025-02-12', '2025-02-12', '2025-02-12', '2025-02-12'] },
  { topic: '1.0版本知情同意书递交', publishDate: '2025-02-12', deadline: '2025-02-12', dates: ['2025-02-12', '2025-02-12', '2025-02-12', '2025-02-12'] },
  /* ===== ON102 项目排期（瑞金医院留空，供执行人员张兰演示「更新」录入） ===== */
  { topic: 'ON102 1.0版本方案递交', publishDate: '2026-04-20', deadline: '2026-05-20', dates: ['2026-04-22', '2026-04-25', '2026-04-28', '2026-05-06'] },
  { topic: 'ON102 伦理递交资料包递交', publishDate: '2026-05-18', deadline: '2026-06-18', dates: ['2026-05-20', '2026-05-22', '2026-05-25', '2026-06-02'] },
  /* ===== ON103 项目排期（瑞金医院留空待录入） ===== */
  { topic: 'ON103 1.0版本方案递交', publishDate: '2026-05-06', deadline: '2026-06-06', dates: ['2026-05-08', '2026-05-10', '2026-05-13', '2026-05-20'] },
  { topic: 'ON103 伦理递交资料包递交', publishDate: '2026-06-15', deadline: '2026-07-15', dates: ['2026-06-18', '2026-06-20', '2026-06-25', '2026-07-02'] },
]

export interface SubmissionFile {
  id: string
  topic: string
  file: string
  kind: FileKind
  projectNo: string
  uploadDate: string
  size: string
  published: boolean
}

export const submissionFiles: SubmissionFile[] = [
  { id: 'sf1', topic: 'ON101研究方案递交', file: 'ON101–研究方案–1.0–20250602', kind: 'pdf', projectNo: 'ON101CLCT01', uploadDate: '2026-12-12', size: '193.1KM', published: false },
  { id: 'sf2', topic: 'ON101研究者手册', file: 'ON101–研究者手册–1.0–20250602', kind: 'pdf', projectNo: 'ON101CLCT01', uploadDate: '2026-12-12', size: '193.1KM', published: false },
  { id: 'sf3', topic: 'ON1015.0版本研究方案', file: 'ON101–5.0 版本研究方案及递交资料', kind: 'folder', projectNo: 'ON101CLCT01', uploadDate: '2026-12-12', size: '193.1KM', published: false },
  { id: 'sf4', topic: 'ON1015.0版本研究方案', file: 'ON101–5.0 版本研究方案及递交资料', kind: 'folder', projectNo: 'ON101CLCT01', uploadDate: '2026-12-12', size: '193.1KM', published: false },
  /* ===== ON102 项目（sf5 / sf6 已发布，执行端可见；sf7 待发布，PM 可演示发布） ===== */
  { id: 'sf5', topic: 'ON102研究方案递交', file: 'ON102–研究方案–1.0–20260420', kind: 'pdf', projectNo: 'ON102CL01', uploadDate: '2026-04-20', size: '215.6KM', published: true },
  { id: 'sf6', topic: 'ON102伦理递交资料包', file: 'ON102–伦理递交资料包–20260518', kind: 'folder', projectNo: 'ON102CL01', uploadDate: '2026-05-18', size: '402.3KM', published: true },
  { id: 'sf7', topic: 'ON102知情同意书递交', file: 'ON102–知情同意书–2.0–20260610', kind: 'pdf', projectNo: 'ON102CL01', uploadDate: '2026-06-10', size: '96.8KM', published: false },
  /* ===== ON103 项目（sf8 / sf9 已发布；sf10 待发布） ===== */
  { id: 'sf8', topic: 'ON103研究方案递交', file: 'ON103–研究方案–1.0–20260506', kind: 'pdf', projectNo: 'ON103CL301', uploadDate: '2026-05-06', size: '215.6KM', published: true },
  { id: 'sf9', topic: 'ON103伦理递交资料包', file: 'ON103–伦理递交资料包–20260615', kind: 'folder', projectNo: 'ON103CL301', uploadDate: '2026-06-15', size: '398.7KM', published: true },
  { id: 'sf10', topic: 'ON103知情同意书递交', file: 'ON103–知情同意书–1.0–20260620', kind: 'pdf', projectNo: 'ON103CL301', uploadDate: '2026-06-20', size: '96.8KM', published: false },
]

/** 递交文件夹包含的具体文件（执行端 SUBMISSION 文件夹钻取查看/下载） */
export const submissionFolderFiles: Record<string, { name: string; size: string; kind: 'folder' | 'pdf' }[]> = {
  sf3: [
    { name: 'ON101–研究方案–5.0–20250602', size: '120.4KM', kind: 'pdf' },
    { name: 'ON101–知情同意书–5.0–20250602', size: '45.2KM', kind: 'pdf' },
    { name: 'ON101–研究者手册–5.0–20250602', size: '88.6KM', kind: 'pdf' },
    { name: 'ON101–病例报告表–5.0–20250602', size: '62.0KM', kind: 'pdf' },
  ],
  sf4: [
    { name: 'ON101–研究方案–5.0–20250602', size: '120.4KM', kind: 'pdf' },
    { name: 'ON101–伦理递交信–5.0–20250602', size: '36.8KM', kind: 'pdf' },
  ],
  sf6: [
    { name: 'ON102–伦理递交信–1.0–20260518', size: '48.6KM', kind: 'pdf' },
    { name: 'ON102–研究方案–1.0–20260420', size: '215.6KM', kind: 'pdf' },
    { name: 'ON102–知情同意书–1.0–20260425', size: '82.4KM', kind: 'pdf' },
    { name: 'ON102–病例报告表–1.0–20260506', size: '55.7KM', kind: 'pdf' },
  ],
  sf9: [
    { name: 'ON103–伦理递交信–1.0–20260615', size: '48.6KM', kind: 'pdf' },
    { name: 'ON103–研究方案–1.0–20260506', size: '215.6KM', kind: 'pdf' },
    { name: 'ON103–知情同意书–1.0–20260510', size: '82.4KM', kind: 'pdf' },
    { name: 'ON103–病例报告表–1.0–20260520', size: '52.1KM', kind: 'pdf' },
  ],
}

/* 新建递交弹窗 */
export interface NewSubmissionRow {
  id: string
  topic: string
  projectNo: string
  deadline: string
  isNew?: boolean
}

export const newSubmissionRows: NewSubmissionRow[] = [
  { id: 'n1', topic: 'ON1015.0版本研究方案', projectNo: 'ON101CLK0912', deadline: '2025-02-12' },
  { id: 'n2', topic: 'ON101研究方案递交', projectNo: 'ON101CLK0912', deadline: '2025-02-12' },
]

/* ---------- Transfer ---------- */

export interface TransferStatusRow {
  project: string
  uploaded: number
  archived: number
}

export const transferStatusRows: TransferStatusRow[] = [
  { project: 'ON101', uploaded: 55, archived: 20 },
  { project: 'ON102', uploaded: 45, archived: 20 },
]

export interface TransferFile {
  id: string
  name: string
  kind: FileKind
  date: string
  size: string
  projectNo: string
  archived: boolean
}

export const transferFiles: TransferFile[] = [
  { id: 't1', name: 'Study–TMF', kind: 'folder', date: '2026-12-12', size: '193.1KM', projectNo: 'ON101CL103', archived: false },
  { id: 't2', name: 'Study–TMF', kind: 'pdf', date: '2026-12-12', size: '193.1KM', projectNo: 'ON101CL103', archived: false },
  { id: 't3', name: 'Study–TMF', kind: 'folder', date: '2026-12-12', size: '193.1KM', projectNo: 'ON101CL103', archived: false },
  { id: 't4', name: 'Study–TMF', kind: 'pdf', date: '2026-12-12', size: '193.1KM', projectNo: 'ON101CL103', archived: false },
]

/* ---------- REVIEW ---------- */

export interface ReviewStatusRow {
  site: string
  uploaded: number
  pending: number
  rejected: number
  archived: number
}

export const reviewStatusRows: ReviewStatusRow[] = [
  { site: '江苏大学附属医院', uploaded: 55, pending: 55, rejected: 20, archived: 20 },
  { site: '上海瑞金医院', uploaded: 45, pending: 45, rejected: 20, archived: 20 },
]

export interface ReviewFile {
  id: string
  name: string
  kind: FileKind
  projectNo: string
  uploader: string
  updatedAt: string
  size: string
}

export const reviewFiles: ReviewFile[] = [
  { id: 'rv1', name: 'ON101–伦理递交信–上海瑞金医院–20250112', kind: 'pdf', projectNo: 'ON101CL01', uploader: '张兰', updatedAt: '2026-12-12', size: '193.1KM' },
  { id: 'rv2', name: 'ON101CLCT07–SITE TMF —上海中山医院', kind: 'folder', projectNo: 'ON101CL01', uploader: '张兰', updatedAt: '2026-12-12', size: '193.1KM' },
  { id: 'rv3', name: 'ON101CLCT07–SITE TMF —上海瑞金医院', kind: 'folder', projectNo: 'ON101CL01', uploader: '张兰', updatedAt: '2026-12-12', size: '193.1KM' },
  { id: 'rv4', name: 'ON101CLCT07–SITE TMF —上海中西结合医院', kind: 'folder', projectNo: 'ON101CL01', uploader: '张兰', updatedAt: '2026-12-12', size: '193.1KM' },
]

/* ---------- PDF 预览 / 文件属性 ---------- */

export const pdfFileName = 'ONkol012345-syudy-2026-02-12.pdf'

export interface FileAttr {
  label: string
  value: string
}

export const pdfFileAttrs: FileAttr[] = [
  { label: '文件名', value: pdfFileName },
  { label: '项目编号', value: 'ON101CLCT06' },
  { label: '研究中心', value: '上海瑞金医院' },
  { label: '文件类型', value: 'PDF' },
  { label: '文件大小', value: '193.1KB' },
  { label: '版本', value: 'V1.0' },
  { label: '上传人', value: '张兰' },
  { label: '上传日期', value: '2026-02-12' },
  { label: '审核人', value: '石磊' },
  { label: '状态', value: '待审核' },
  { label: '归档状态', value: '未归档' },
  { label: '密级', value: '内部' },
]

export interface ChangeLog {
  time: string
  user: string
  action: string
}

export const pdfChangeLogs: ChangeLog[] = [
  { time: '2026-02-12 10:24', user: '张兰', action: '上传文件' },
  { time: '2026-02-13 14:02', user: '石磊', action: '提交审核' },
  { time: '2026-02-14 09:31', user: '石磊', action: '更新文件属性' },
]

/* ---------- Favorite ---------- */

export interface FavoriteFile {
  id: string
  name: string
  kind: FileKind
  projectNo: string
  favDate: string
  size: string
}

export const favoriteFiles: FavoriteFile[] = [
  { id: 'fav1', name: 'ON101–伦理递交信–上海瑞金医院–20250112', kind: 'pdf', projectNo: 'ON101CL01', favDate: '2026-12-12', size: '193.1KM' },
  { id: 'fav2', name: 'ON101CLCT06 STUDY TMF', kind: 'folder', projectNo: 'ON101CL01', favDate: '2026-11-08', size: '193.1KM' },
  { id: 'fav3', name: 'ON101–研究方案–1.0–20250602', kind: 'pdf', projectNo: 'ON101CLCT01', favDate: '2026-10-21', size: '193.1KM' },
  { id: 'fav4', name: 'ON101CLCT07–SITE TMF —上海瑞金医院', kind: 'folder', projectNo: 'ON101CL01', favDate: '2026-09-15', size: '193.1KM' },
]
