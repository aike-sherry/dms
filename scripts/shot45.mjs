import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5199'
const OUT = 'C:\\Users\\huawe\\Documents\\Kimi\\Workspaces\\ClinicalTrialsDocumentM\\shots'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  defaultViewport: { width: 1600, height: 1000 },
})
const page = await browser.newPage()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' }))
  /* 清空旧持久化数据，保证从 DEMO 种子全新开始 */
  localStorage.removeItem('clinx-data-v2')
})
await page.goto(`${BASE}/#/transfer`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)

// ① 打开「归档规则」弹窗
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '归档规则')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(1000)
await page.screenshot({ path: `${OUT}\\45-transfer-rules.png` })

// 关闭弹窗
await page.keyboard.press('Escape')
await sleep(600)

// ② 对文件夹「ON101–研究文档」点归档（子文件「研究方案」→ 01 试验管理文件 / 研究方案）
await page.evaluate(() => {
  const row = [...document.querySelectorAll('tr')].find((r) => r.textContent.includes('研究文档'))
  const btn = [...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === '归档')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(1200)
await page.screenshot({ path: `${OUT}\\45-transfer-archive-toast.png` })
await sleep(3500)

// ②b 对无法识别的文件「Study–TMF」(pdf 行，含智能命名链接) 点归档 → 99 待分拣警告
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tr')].filter((r) => r.textContent.includes('Study–TMF'))
  const row = rows.find((r) => r.textContent.includes('智能命名'))
  const btn = [...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === '归档')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(1200)
await page.screenshot({ path: `${OUT}\\45-transfer-unsorted-toast.png` })
await sleep(3000)

// ③ STUDY TMF 钻取：cat-st0 = ON101CL103 STUDY TMF
await page.goto(`${BASE}/#/study?drill=cat-st0`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)
await page.screenshot({ path: `${OUT}\\45-study-zones.png` })

// 钻入「01 试验管理文件」
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '01 试验管理文件')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(800)
await page.screenshot({ path: `${OUT}\\45-study-zone01.png` })

// 钻入「研究方案」文档类型文件夹，看到归档文件
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '研究方案')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(800)
await page.screenshot({ path: `${OUT}\\45-study-doctype.png` })

await browser.close()
console.log('done')
