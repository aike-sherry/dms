/* 一次性：解析 RJQM-文件管理体系.xlsx 生成模板库种子（随后内嵌进 store.tsx，脚本归档） */
import * as XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'node:fs'

const NA_LIKE = new Set(['na', 'n/a', '-', '—', '--', '无'])
const HEADER_KEYS = ['一级目录', '二级目录', '三级目录', '文件类别', '名称', '序号']
const SEQ_RE = /^序\s*号$|^no\.?$/i
const norm = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v).trim()
  return NA_LIKE.has(s.toLowerCase()) ? '' : s
}
const buf = readFileSync('C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/RJQM-文件管理体系.xlsx')
const wb = XLSX.read(buf, { type: 'array' })
const ws = wb.Sheets[wb.SheetNames[0]]
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })
let headerIdx = -1
for (let i = 0; i < Math.min(10, aoa.length); i++) {
  const cells = aoa[i].map((c) => String(c ?? '').trim())
  if (cells.some((c) => HEADER_KEYS.includes(c))) { headerIdx = i; break }
}
const header = aoa[headerIdx].map((c) => String(c ?? '').trim())
const levelCols = []
for (let c = 0; c < header.length && levelCols.length < 3; c++) {
  if (SEQ_RE.test(header[c])) continue
  if (header[c] !== '' || aoa.some((r) => norm(r[c]) !== '')) levelCols.push(c)
}
const tree = []
const counts = [0, 0, 0]
const current = ['', '', '']
const ensure = (siblings, name, depth) => {
  let hit = siblings.find((n) => n.name === name)
  if (!hit) { hit = { name, children: [] }; siblings.push(hit); counts[depth]++ }
  return hit
}
for (let i = headerIdx + 1; i < aoa.length; i++) {
  const vals = levelCols.map((c) => norm(aoa[i][c]))
  if (vals.every((v) => v === '')) continue
  let depth = -1
  for (let d = 0; d < vals.length; d++) {
    if (vals[d] !== '') { current[d] = vals[d]; depth = d; for (let j = d + 1; j < 3; j++) current[j] = '' }
  }
  if (depth === -1) continue
  let nodes = tree
  for (let d = 0; d <= depth; d++) nodes = ensure(nodes, current[d], d).children
}
console.error(`counts: 一级 ${counts[0]} 二级 ${counts[1]} 三级 ${counts[2]}`)
writeFileSync('scripts/_seed-tree.json', JSON.stringify(tree, null, 0))
console.log(JSON.stringify(tree))
