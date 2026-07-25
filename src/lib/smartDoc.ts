/* TMF 文件「智能命名 / 智能纠错」规则引擎
   当前为本地规则模拟（文档类型词典 + 版本号/日期识别），后续可替换为 AI 服务接口 */

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
const DOC_TYPES: Array<{ type: string; keys: string[] }> = [
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

const VERSION_RE = /[vV]?\s*(\d+\.\d+)(?=[^\d]|$)/
const DATE_RES = [
  /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/,
  /(20\d{2})年(\d{1,2})月(\d{1,2})日?/,
  /(20\d{2})(\d{2})(\d{2})/,
]

/** 解析文件名，识别文档类型 / 版本号 / 日期 */
export function analyzeName(raw: string): NameAnalysis {
  const lower = raw.toLowerCase()
  const hit = DOC_TYPES.find((d) => d.keys.some((k) => lower.includes(k)))
  const vm = raw.match(VERSION_RE)
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
    version: vm ? `V${vm[1]}` : null,
    date,
  }
}

/** 生成 TMF 规范命名：文档类型 V版本（日期） */
export function suggestName(raw: string): string {
  const a = analyzeName(raw)
  const base = a.matched ? a.docType : raw.trim().replace(/\s+/g, ' ')
  const name = `${base} ${a.version ?? 'V1.0'}`
  return a.date ? `${name}（${a.date}）` : name
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

/** 一键修复：清特殊字符与空格 → 规范化命名 → 重名追加序号 */
export function applyFixes(raw: string, siblingNames: string[]): string {
  const cleaned = raw.replace(/[/\\:*?"<>|]/g, '_').trim().replace(/\s+/g, ' ')
  let name = suggestName(cleaned)
  if (siblingNames.includes(name)) {
    let i = 2
    while (siblingNames.includes(`${name}（${i}）`)) i++
    name = `${name}（${i}）`
  }
  return name
}
