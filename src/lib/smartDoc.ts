/* TMF 文件「智能命名 / 智能纠错」规则引擎
   当前为本地规则模拟（文档类型词典 + 版本号/日期识别），后续可替换为 AI 服务接口 */
import { toast } from 'sonner'
import type { TmfFile } from '@/store'

export interface NameAnalysis {
  /** 识别出的标准文档类型，未识别时为空串 */
  docType: string
  /** 是否命中文档类型词典 */
  matched: boolean
  /** 版本号（如 V1.0），未识别为 null */
  version: string | null
  /** 规范化日期 YYYY-MM-DD，未识别为 null */
  date: string | null
}

/** TMF 常见文档类型词典：标准名 → 文件名关键词（小写匹配） */
export const DOC_TYPES: Array<{ type: string; keys: string[] }> = [
  { type: '知情同意书', keys: ['知情', 'icf', 'consent'] },
  { type: '研究方案', keys: ['方案', 'protocol'] },
  { type: '伦理委员会批件', keys: ['伦理', 'ethic'] },
  { type: '研究者简历', keys: ['简历', 'cv'] },
  { type: '授权分工表', keys: ['授权', 'delegation'] },
  { type: '实验室检查报告', keys: ['实验室', 'lab'] },
  { type: '严重不良事件报告', keys: ['sae', '严重不良'] },
  { type: '方案偏离报告', keys: ['偏离', 'deviation'] },
  { type: '监查报告', keys: ['监查', 'monitoring'] },
  { type: '试验用药品管理记录', keys: ['药品', 'drug'] },
  { type: '培训记录', keys: ['培训', 'training'] },
  { type: '保险文件', keys: ['保险', 'insurance'] },
  { type: '合同协议', keys: ['合同', '协议', 'agreement', 'contract'] },
  { type: '受试者日记卡', keys: ['日记', 'diary'] },
  { type: '病例报告表', keys: ['病例报告', 'crf'] },
  { type: '数据管理计划', keys: ['数据管理'] },
  { type: '统计分析计划', keys: ['统计分析', 'sap'] },
  { type: '备忘录', keys: ['备忘', 'memo'] },
]

/* ================= STUDY TMF 标准分区（Zone） ================= */

/** STUDY TMF 8 个标准分区：归档时文件按路由自动归入对应分区文件夹 */
export const TMF_ZONES = [
  '01 试验管理文件',
  '02 伦理与监管文件',
  '03 研究者与中心文件',
  '04 受试者文件',
  '05 试验用药文件',
  '06 数据管理与统计',
  '07 监查与安全性',
  '99 待分拣',
] as const

export type TmfZone = (typeof TMF_ZONES)[number]

/** 待分拣分区：未识别文档类型或无匹配路由时的归档目标（需人工分拣） */
export const UNSORTED_ZONE: TmfZone = '99 待分拣'

/** 全部标准文档类型名（归档规则下拉的备选项） */
export const DOC_TYPE_NAMES: string[] = DOC_TYPES.map((d) => d.type)

/** 默认路由映射：文档类型 → 分区（系统初始配置，可在 TRANSFER「归档规则」中增删改） */
export const DEFAULT_ZONE_BY_DOC_TYPE: Record<string, TmfZone> = {
  研究方案: '01 试验管理文件',
  合同协议: '01 试验管理文件',
  备忘录: '01 试验管理文件',
  伦理委员会批件: '02 伦理与监管文件',
  保险文件: '02 伦理与监管文件',
  研究者简历: '03 研究者与中心文件',
  授权分工表: '03 研究者与中心文件',
  培训记录: '03 研究者与中心文件',
  知情同意书: '04 受试者文件',
  实验室检查报告: '04 受试者文件',
  受试者日记卡: '04 受试者文件',
  试验用药品管理记录: '05 试验用药文件',
  病例报告表: '06 数据管理与统计',
  数据管理计划: '06 数据管理与统计',
  统计分析计划: '06 数据管理与统计',
  严重不良事件报告: '07 监查与安全性',
  方案偏离报告: '07 监查与安全性',
  监查报告: '07 监查与安全性',
}

/* 版本号识别增强：V 前缀允许整数（V2 → V2.0）或小数（V2.5 原样）；无前缀必须带小数点
   （1.0 → V1.0，保留种子数据旧行为），纯数字（日期 20260301、编号等）不识别为版本号 */
const VERSION_RE = /(?:[vV]\s*(\d+(?:\.\d+)?)|(\d+\.\d+))(?=[^\d]|$)/
const DATE_RES = [
  /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/,
  /(20\d{2})年(\d{1,2})月(\d{1,2})日?/,
  /(20\d{2})(\d{2})(\d{2})/,
]

/** 解析版本号字符串（如 V2.5）为 {major, minor}；无法解析返回 null */
export function parseVersion(v: string): { major: number; minor: number } | null {
  const m = v.match(/[vV]?\s*(\d+)(?:\.(\d+))?/)
  if (!m) return null
  return { major: parseInt(m[1], 10), minor: m[2] ? parseInt(m[2], 10) : 0 }
}

/** 版本比较：先主版本后次版本；a 较新返回正数，相同返回 0 */
export function compareVersion(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return 0
  return pa.major - pb.major || pa.minor - pb.minor
}

/** 版本递增：次版本为 0 时进主版本（V1.0→V2.0），否则进次版本（V2.5→V2.6） */
export function bumpVersion(v: string): string {
  const p = parseVersion(v)
  if (!p) return 'V1.0'
  return p.minor === 0 ? `V${p.major + 1}.0` : `V${p.major}.${p.minor + 1}`
}

/** 解析文件名，识别文档类型 / 版本号 / 日期 */
export function analyzeName(raw: string): NameAnalysis {
  const lower = raw.toLowerCase()
  const hit = DOC_TYPES.find((d) => d.keys.some((k) => lower.includes(k)))
  const vm = raw.match(VERSION_RE)
  const vnum = vm ? vm[1] || vm[2] : ''
  let date: string | null = null
  for (const re of DATE_RES) {
    const m = raw.match(re)
    if (m) {
      date = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
      break
    }
  }
  return {
    docType: hit?.type ?? '',
    matched: !!hit,
    version: vnum ? `V${vnum.includes('.') ? vnum : `${vnum}.0`}` : null,
    date,
  }
}

/** 生成 TMF 规范命名：文档类型 V版本（日期）；versionOverride 用于版本链递增时指定新版本号 */
export function suggestName(raw: string, versionOverride?: string): string {
  const a = analyzeName(raw)
  const base = a.matched ? a.docType : raw.trim().replace(/\s+/g, ' ')
  const name = `${base} ${versionOverride ?? a.version ?? 'V1.0'}`
  return a.date ? `${name}（${a.date}）` : name
}

/* ================= 命名规则模板 ================= */

/** 默认命名规则模板（PM 可在 TRANSFER「命名规则」中修改，持久化保存） */
export const DEFAULT_NAMING_TEMPLATE = '{项目编号}-{文档类型}-V{版本}（{日期}）'

/** 命名规则模板渲染：支持占位符 {项目编号} {文档类型} {版本} {日期} {研究中心}；
    {版本} 传不含 V 的版本号（模板自带 V/v 前缀，避免出现 VV1.0）；
    空值字段优雅降级——去空括号对、折叠连续连接符、剔除首尾连接符 */
export function applyNamingTemplate(
  tpl: string,
  ctx: { projectNo: string; docType: string; version: string; date?: string | null; center?: string },
): string {
  const version = ctx.version.replace(/^[vV]\s*/, '')
  let out = tpl
    .replace(/\{项目编号\}/g, ctx.projectNo)
    .replace(/\{文档类型\}/g, ctx.docType)
    .replace(/\{版本\}/g, version)
    .replace(/\{日期\}/g, ctx.date ?? '')
    .replace(/\{研究中心\}/g, ctx.center ?? '')
  out = out.replace(/[（(]\s*[)）]/g, '')
  out = out.replace(/(\s*[-–—_·]\s*){2,}/g, '-')
  out = out.replace(/^\s*[-–—_·]\s*/, '').replace(/\s*[-–—_·]\s*$/, '')
  return out.replace(/\s{2,}/g, ' ').trim()
}

export type IssueCode = 'badChars' | 'spaces' | 'missingVersion' | 'badDate' | 'nonStandard' | 'dupName'

export interface Issue {
  code: IssueCode
  label: string
}

/** 纠错检查：返回文件名存在的问题清单 */
export function findIssues(raw: string, siblingNames: string[]): Issue[] {
  const issues: Issue[] = []
  if (/[/\\:*?"<>|]/.test(raw)) {
    issues.push({ code: 'badChars', label: '文件名含特殊字符（/ \\ : * ? " < > |），不符合归档要求' })
  }
  if (raw !== raw.trim() || /\s{2,}/.test(raw)) {
    issues.push({ code: 'spaces', label: '文件名存在首尾空格或连续空格' })
  }
  const a = analyzeName(raw)
  if (!a.version) {
    issues.push({ code: 'missingVersion', label: '缺少版本号标识（如 V1.0）' })
  }
  if (a.date && !raw.includes(a.date)) {
    issues.push({ code: 'badDate', label: '日期格式不统一，建议规范为 YYYY-MM-DD' })
  }
  if (!a.matched) {
    issues.push({ code: 'nonStandard', label: '未识别出 TMF 文档类型，命名不符合目录规范' })
  }
  if (siblingNames.includes(raw.trim())) {
    issues.push({ code: 'dupName', label: '与同项目下已有文件重名' })
  }
  return issues
}

/** 同目录重名时追加序号（2）（3）… */
export function dedupName(name: string, siblingNames: string[]): string {
  if (!siblingNames.includes(name)) return name
  let i = 2
  while (siblingNames.includes(`${name}（${i}）`)) i++
  return `${name}（${i}）`
}

/** 一键修复：清特殊字符与空格 → 规范化命名 → 重名追加序号 */
export function applyFixes(raw: string, siblingNames: string[]): string {
  const cleaned = raw.replace(/[/\\:*?"<>|]/g, '_').trim().replace(/\s+/g, ' ')
  return dedupName(suggestName(cleaned), siblingNames)
}

/* ================= 上传即自动命名 ================= */

/** 版本链上下文：提供当前库内文件与本次上传归属，用于同文档新版本自动递增并关联历史版本；
    template/today 用于按命名规则模板渲染文件名（PM TRANSFER「命名规则」配置） */
export interface AutoNameCtx {
  files: Array<Pick<TmfFile, 'id' | 'name' | 'kind' | 'projectNo' | 'center' | 'status'>>
  projectNo: string
  center: string
  /** 命名规则模板；提供时命中文件按模板渲染（缺省沿用 suggestName 规范命名） */
  template?: string
  /** 模板 {日期} 兜底：文件名解析不出日期时使用（一般为今天） */
  today?: string
}

export interface AutoNameResult {
  name: string
  matched: boolean
  renamed: boolean
  /** 关联的上一版本文件 id（版本链命中且有入库文件时） */
  versionOf?: string
  /** 检测到的上一版本号（如 V3.0） */
  prevVersion?: string
  /** 上一版本文件名 */
  prevName?: string
}

export interface ChainResolution {
  /** 应采用的新版本号（含 V 前缀，如 V4.0） */
  version: string
  /** 关联的上一版本文件 id（历史文件已入库时） */
  versionOf?: string
  /** 历史最大版本号（如 V3.0） */
  prevVersion?: string
  /** 上一版本文件名 */
  prevName?: string
}

/** 版本链解析：同项目同中心同文档类型的历史文件（不含文件夹与已驳回）取最大版本，
    新版本 = max(文件名解析版, 历史最大版 +1)；无历史时返回文件名解析版（无则 V1.0） */
export function resolveChainVersion(raw: string, docType: string, ctx: AutoNameCtx): ChainResolution {
  const a = analyzeName(raw)
  const parsedV = a.version ?? 'V1.0'
  const history = ctx.files.filter(
    (f) =>
      f.kind !== 'folder' &&
      f.status !== 'rejected' &&
      f.projectNo === ctx.projectNo &&
      f.center === ctx.center &&
      analyzeName(f.name).docType === docType,
  )
  if (history.length === 0) return { version: parsedV }
  /* 历史最大版本（文件名未识别出版本号的视为 V1.0） */
  let best = history[0]
  let bestV = analyzeName(best.name).version ?? 'V1.0'
  for (const f of history.slice(1)) {
    const v = analyzeName(f.name).version ?? 'V1.0'
    if (compareVersion(v, bestV) > 0) {
      best = f
      bestV = v
    }
  }
  const result: ChainResolution = {
    version: compareVersion(parsedV, bestV) > 0 ? parsedV : bumpVersion(bestV),
    prevVersion: bestV,
    prevName: best.name,
  }
  if (best.id) result.versionOf = best.id
  return result
}

/** 单文件自动命名：命中词典 → 规范命名（ctx.template 存在时按命名规则模板渲染；含同目录重名追加序号）；
    未命中 → 保留原名。传入 ctx 时启用版本链：新版本号取「文件名解析版」与「历史最大版 +1」中的较新者 */
export function autoName(raw: string, siblingNames: string[], ctx?: AutoNameCtx): AutoNameResult {
  const a = analyzeName(raw)
  if (!a.matched) return { name: raw, matched: false, renamed: false }

  const chain = ctx ? resolveChainVersion(raw, a.docType, ctx) : undefined
  const version = chain?.version ?? a.version ?? 'V1.0'

  const cleaned = raw.replace(/[/\\:*?"<>|]/g, '_').trim().replace(/\s+/g, ' ')
  const name = dedupName(
    ctx?.template
      ? applyNamingTemplate(ctx.template, {
          projectNo: ctx.projectNo,
          docType: a.docType,
          version,
          date: a.date ?? ctx.today ?? null,
          center: ctx.center,
        })
      : suggestName(cleaned, chain?.version),
    siblingNames,
  )
  const result: AutoNameResult = { name, matched: true, renamed: name !== raw }
  if (chain?.versionOf) result.versionOf = chain.versionOf
  if (chain?.prevVersion) result.prevVersion = chain.prevVersion
  if (chain?.prevName) result.prevName = chain.prevName
  return result
}

/** 批量自动命名：siblings 随批内逐个累积，保证同批文件之间也不重名；
    传入 ctx 时维护版本链 pool 副本，同批同文档文件依次递增（如 V4.0、V5.0） */
export function autoNameBatch(rawNames: string[], existingNames: string[], ctx?: AutoNameCtx) {
  const siblings = [...existingNames]
  const pool = ctx ? [...ctx.files] : undefined
  return rawNames.map((raw) => {
    const r = autoName(raw, siblings, ctx && pool ? { ...ctx, files: pool } : undefined)
    siblings.push(r.name)
    /* 同批已命名文件推入 pool 供后续文件递增版本（id 为空串表示尚未入库，不产出 versionOf） */
    if (ctx && pool && r.matched) {
      pool.push({ id: '', name: r.name, kind: 'pdf', projectNo: ctx.projectNo, center: ctx.center, status: 'uploaded' })
    }
    return { from: raw, ...r }
  })
}

/** 上传自动命名的合并提示：一次上传只发一条 toast（有未识别文件时用警告语气）；
    versionNotes 为版本链提示（检测到历史版本并自动递增关联），插在自动命名明细之后 */
export function notifyAutoName(opts: {
  title: string
  renamed: string[]
  unmatched: number
  extra?: string
  versionNotes?: string[]
}) {
  const parts: string[] = []
  if (opts.renamed.length > 0) parts.push(`${opts.renamed.length} 个文件已自动命名：${opts.renamed.join('；')}`)
  if (opts.versionNotes && opts.versionNotes.length > 0) parts.push(...opts.versionNotes)
  if (opts.unmatched > 0) parts.push(`${opts.unmatched} 个未识别文档类型，保留原名（归档时将进入 99 待分拣）`)
  if (opts.extra) parts.push(opts.extra)
  const description = parts.join('；')
  if (opts.unmatched > 0) toast.warning(opts.title, { description })
  else toast.success(opts.title, { description })
}
