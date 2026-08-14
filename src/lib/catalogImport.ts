/* 目录 Excel 导入：解析 .xlsx/.xls/.csv 生成一/二/三级目录树
   列结构自动识别（宽容映射 + 表头行自动定位）：
   - 标准模板表头：一级目录 / 二级目录 / 三级目录(可选)
   - 用户现有格式：序号 / 文件类别 / 名称 → 文件类别=一级，名称=二级
   - 通则：除序号列外，从左到右依次视为一级、二级、三级；空白单元格向上继承
     （fill-down，天然兼容合并单元格）；值 trim；NA / N/A / - / 空 跳过；整行空跳过 */
import * as XLSX from 'xlsx'

export interface CatalogNode {
  name: string
  children: CatalogNode[]
}

export interface ParsedCatalog {
  tree: CatalogNode[]
  /** [一级数, 二级数, 三级数] */
  counts: [number, number, number]
  /** 消费的数据行数 */
  rows: number
}

/* 视为「无子项/空」的值（比较时忽略大小写） */
const NA_LIKE = new Set(['na', 'n/a', '-', '—', '--', '无'])
const HEADER_KEYS = ['一级目录', '二级目录', '三级目录', '文件类别', '名称', '序号']
const SEQ_RE = /^序\s*号$|^no\.?$/i

const norm = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  const s = String(v).trim()
  return NA_LIKE.has(s.toLowerCase()) ? '' : s
}

export function parseCatalogWorkbook(buf: ArrayBuffer | string): ParsedCatalog {
  const wb = typeof buf === 'string' ? XLSX.read(buf, { type: 'string' }) : XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('文件中没有工作表')
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false })
  if (aoa.length === 0) throw new Error('工作表为空')

  /* 表头行自动定位：前 10 行内第一个含已知表头词的行 */
  let headerIdx = -1
  for (let i = 0; i < Math.min(10, aoa.length); i++) {
    const cells = (aoa[i] as unknown[]).map((c) => String(c ?? '').trim())
    if (cells.some((c) => HEADER_KEYS.includes(c))) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1)
    throw new Error('无法识别表头（支持「一级目录/二级目录/三级目录」模板或「序号/文件类别/名称」格式）')

  /* 列映射：除序号列外，从左到右依次为一级、二级、三级 */
  const header = (aoa[headerIdx] as unknown[]).map((c) => String(c ?? '').trim())
  const levelCols: number[] = []
  for (let c = 0; c < header.length && levelCols.length < 3; c++) {
    if (SEQ_RE.test(header[c])) continue
    const hasHeader = header[c] !== ''
    const hasData = aoa.some((r) => norm((r as unknown[])[c]) !== '')
    if (hasHeader || hasData) levelCols.push(c)
  }
  if (levelCols.length === 0) throw new Error('未找到目录列')

  /* fill-down 构建目录树（同名同级去重合并） */
  const tree: CatalogNode[] = []
  const counts: [number, number, number] = [0, 0, 0]
  const current: string[] = ['', '', '']
  let rows = 0

  const ensure = (siblings: CatalogNode[], name: string, depth: number): CatalogNode => {
    let hit = siblings.find((n) => n.name === name)
    if (!hit) {
      hit = { name, children: [] }
      siblings.push(hit)
      counts[depth]++
    }
    return hit
  }

  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const vals = levelCols.map((c) => norm((aoa[i] as unknown[])[c]))
    if (vals.every((v) => v === '')) continue /* 整行空跳过 */
    rows++
    let depth = -1
    for (let d = 0; d < vals.length; d++) {
      if (vals[d] !== '') {
        current[d] = vals[d]
        depth = d
        for (let j = d + 1; j < 3; j++) current[j] = '' /* 新值出现时清空更深层继承 */
      }
    }
    if (depth === -1) continue
    let nodes = tree
    for (let d = 0; d <= depth; d++) {
      const node = ensure(nodes, current[d], d)
      nodes = node.children
    }
  }

  if (counts[0] === 0) throw new Error('未解析到任何目录条目')
  return { tree, counts, rows }
}

/** 生成并下载标准导入模板（一级目录/二级目录/三级目录 + 示例行） */
export function downloadCatalogTemplate() {
  const aoa = [
    ['一级目录', '二级目录', '三级目录'],
    ['试验管理文件', '研究方案', ''],
    ['', '研究方案修订版', ''],
    ['伦理与监管文件', '伦理委员会批件', ''],
    ['受试者文件', '知情同意书', '已签署知情同意书'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 22 }, { wch: 26 }, { wch: 26 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '目录模板')
  XLSX.writeFile(wb, '目录导入模板.xlsx')
}
