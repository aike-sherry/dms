/* R39 模式A：目录绑定命名范式骨架——骨架渲染 / 绑定继承解析 / 重名冲突追加 / 占位符词表
   二阶段扩展点：AI 语义识别预填（仅预选择下拉，不落文件名）、标准目录树模板库、批量向导细化 */
import type { NamingTemplate, TmfFile } from '@/store'

/** 可用占位符（admin 骨架编辑速查 chips；渲染时按 '-' 分段替换，空值段整段剔除） */
export const SKELETON_PLACEHOLDERS = [
  '试验编号',
  '文件类型简称',
  '版本号',
  'YYYYMMDD',
  '文档状态',
  '中心编号',
  '访视编号',
  'SAE序号',
] as const

export type SkeletonVars = Partial<Record<(typeof SKELETON_PLACEHOLDERS)[number], string>>

/** 骨架语法校验：占位符必须成对出现且为已知占位符（admin 保存时校验，防手误） */
export function validateSkeleton(skeleton: string): string | null {
  if (!skeleton.trim()) return '骨架不能为空'
  const re = /\{([^}]*)\}/g
  let m: RegExpExecArray | null
  let hasAny = false
  while ((m = re.exec(skeleton))) {
    hasAny = true
    if (!(SKELETON_PLACEHOLDERS as readonly string[]).includes(m[1])) return `未知占位符 {${m[1]}}`
  }
  if (!hasAny) return '骨架至少包含一个占位符'
  /* 成对占位符全部剥离后仍残留大括号 → 不成对 */
  const stripped = skeleton.replace(/\{[^}]*\}/g, '')
  if (stripped.includes('{') || stripped.includes('}')) return '占位符大括号不成对'
  return null
}

/** 渲染骨架：按 '-' 分段逐段替换占位符；段内任一占位符为空值则整段剔除（如 SAE{SAE序号} 未填整段消失），
    再折叠多余连接符、去首尾连接符；{YYYYMMDD} 调用方传紧凑格式 */
export function renderSkeleton(skeleton: string, vars: SkeletonVars): string {
  const segs = skeleton.split('-')
  const out: string[] = []
  for (const seg of segs) {
    let s = seg
    let drop = false
    const re = /\{([^}]*)\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(seg))) {
      const key = m[1] as keyof SkeletonVars
      const v = vars[key]?.trim() ?? ''
      if (v === '') {
        drop = true
        break
      }
      s = s.split(m[0]).join(v)
    }
    if (!drop && s.trim()) out.push(s.trim())
  }
  return out.join('-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '')
}

/** 骨架预览（admin 列表/编辑实时预览）：占位符以示例值渲染 */
export const SKELETON_SAMPLE_VARS: SkeletonVars = {
  试验编号: 'ON101CL01',
  文件类型简称: '方案',
  版本号: '1.0',
  YYYYMMDD: '20260814',
  文档状态: '终版',
  中心编号: '上海瑞金医院',
  访视编号: 'RMV01',
  SAE序号: '003',
}

/** 绑定继承：解析某文件夹的有效骨架——沿 parentId 祖先链向上找最近的 namingTemplateId 绑定。
    返回 null = 全链未绑定（上传走手动命名）；holder=携带绑定的文件夹，
    inherited = holder 不是传入文件夹本身（调用处据此显示「继承自：{holder.name}」） */
export function effectiveTemplateRef(
  files: TmfFile[],
  folderId: string,
  templates: NamingTemplate[],
): { template: NamingTemplate; holder: TmfFile; inherited: boolean } | null {
  const byId = new Map(files.map((f) => [f.id, f]))
  const tplById = new Map(templates.map((t) => [t.id, t]))
  let cur = byId.get(folderId)
  let hops = 0
  while (cur && hops < 50) {
    if (cur.namingTemplateId) {
      const template = tplById.get(cur.namingTemplateId)
      if (template) return { template, holder: cur, inherited: cur.id !== folderId }
      return null
    }
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
    hops++
  }
  return null
}

/** R39 重名冲突策略：目标文件夹内已存在同名 displayFilename 时自动追加（2）（3）…（siblings 为已有展示名集合） */
export function appendDupSuffix(name: string, siblings: Iterable<string>): string {
  const set = new Set(siblings)
  if (!set.has(name)) return name
  for (let n = 2; ; n++) {
    const cand = `${name}（${n}）`
    if (!set.has(cand)) return cand
  }
}

/** 向导可选版本号（存值不含 V 前缀；骨架中 V 为字面量）。二阶段可扩展为按历史版本链自动递增建议 */
export const VERSION_OPTIONS = ['1.0', '1.1', '1.2', '2.0', '2.1', '3.0'] as const

/** 向导可选文档状态（PRD 固定四值） */
export const DOC_STATUS_OPTIONS = ['草稿', '审核中', '终版', '作废'] as const
