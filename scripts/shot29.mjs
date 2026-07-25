import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5199'
const OUT = 'C:\\Users\\huawe\\Documents\\Kimi\\Workspaces\\ClinicalTrialsDocumentM\\shots'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--window-size=1600,1000'],
  defaultViewport: { width: 1600, height: 1000 },
})
const page = await browser.newPage()

async function realClick(selectorFn, desc) {
  const box = await page.evaluate(selectorFn)
  if (!box) throw new Error(`element not found: ${desc}`)
  await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2)
}

await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' }))
  localStorage.removeItem('clinx-bg-v1')
})
await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 900))

// 打开右上角设置菜单（真实鼠标点击齿轮）
await realClick(() => {
  const gear = document.querySelector('header svg.lucide-settings')
  const el = gear?.closest('[data-slot="dropdown-menu-trigger"]') ?? gear?.parentElement
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
}, 'settings gear')
await new Promise((r) => setTimeout(r, 700))

// 点击「页面背景」菜单项
await realClick(() => {
  const item = [...document.querySelectorAll('[role=menuitem]')].find((i) =>
    i.textContent.includes('页面背景'),
  )
  if (!item) return null
  const r = item.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
}, 'menu item 页面背景')
await new Promise((r) => setTimeout(r, 800))
await page.screenshot({ path: `${OUT}\\29-bg-dialog.png` })

// 选择「薄荷青」预设色
await realClick(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('薄荷青'))
  if (!btn) return null
  const r = btn.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
}, 'preset 薄荷青')
await new Promise((r) => setTimeout(r, 400))

// 点「完成」关闭弹窗
await realClick(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '完成')
  if (!btn) return null
  const r = btn.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
}, '完成')
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: `${OUT}\\29-bg-applied.png` })

const saved = await page.evaluate(() => localStorage.getItem('clinx-bg-v1'))
console.log('saved bg:', saved)

await browser.close()
console.log('done')
