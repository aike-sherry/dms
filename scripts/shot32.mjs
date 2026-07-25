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

async function realClick(fn, desc) {
  const box = await page.evaluate(fn)
  if (!box) throw new Error(`element not found: ${desc}`)
  await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2)
}

await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' }))
})
await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 900))

// 滚动到 PM 分配卡片
await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(
    (e) => e.children.length === 0 && e.textContent?.trim() === '项目 PM 分配',
  )
  el?.scrollIntoView({ block: 'start' })
})
await new Promise((r) => setTimeout(r, 500))

// 点击 ON101CL103 行的 分配/更换
await realClick(() => {
  const rows = [...document.querySelectorAll('tbody tr')]
  for (const row of rows) {
    if (!row.textContent.includes('ON101CL103')) continue
    const link = [...row.querySelectorAll('a,button,span')].find(
      (e) => e.textContent.trim() === '分配' || e.textContent.trim() === '更换',
    )
    if (link) {
      const r = link.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    }
  }
  return null
}, '分配 link ON101CL103')
await new Promise((r) => setTimeout(r, 700))

// 输入新 PM 姓名
await page.evaluate(() => {
  const input = document.querySelector('[role=dialog] input[list="pm-candidates"]')
  if (input) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, '赵敏')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
})
await new Promise((r) => setTimeout(r, 300))
await page.screenshot({ path: `${OUT}\\32-pm-dialog.png` })

await realClick(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '确认分配')
  if (!btn) return null
  const r = btn.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
}, '确认分配')
await new Promise((r) => setTimeout(r, 800))
await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(
    (e) => e.children.length === 0 && e.textContent?.trim() === '项目 PM 分配',
  )
  el?.scrollIntoView({ block: 'start' })
})
await new Promise((r) => setTimeout(r, 400))
await page.screenshot({ path: `${OUT}\\32-pm-assigned.png` })

console.log('pmMap:', await page.evaluate(() => JSON.parse(localStorage.getItem('clinx-data-v1'))?.pmMap))
await browser.close()
console.log('done')
