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
  localStorage.removeItem('clinx-data-v2')
})
await page.goto(`${BASE}/#/transfer`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)

// 制造待分拣文件：归档无法识别命名的「Study–TMF」(pdf 行) → 99 待分拣
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tr')].filter((r) => r.textContent.includes('Study–TMF'))
  const row = rows.find((r) => r.textContent.includes('智能命名'))
  const btn = [...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === '归档')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(4500)

// 打开待分拣弹窗（按钮带徽标，textContent 含数字，用 includes 匹配）
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('待分拣'))
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(1000)
// ① 待分拣弹窗列表（分区下拉默认 01 + 归位按钮）
await page.screenshot({ path: `${OUT}\\47-unsorted-dialog.png` })

// ② 归位 → toast + 空态刷新
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '归位')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(1200)
await page.screenshot({ path: `${OUT}\\47-unsorted-rehomed.png` })
await sleep(3500)
await page.keyboard.press('Escape')
await sleep(500)
// 徽标应已消失
await page.screenshot({ path: `${OUT}\\47-transfer-badge-gone.png` })

// ③ STUDY TMF (cat-st0 = ON101CL103) 钻取确认归位落位：01 试验管理文件 下直接可见该文件
await page.goto(`${BASE}/#/study?drill=cat-st0`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '01 试验管理文件')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(800)
await page.screenshot({ path: `${OUT}\\47-study-rehomed-zone01.png` })

await browser.close()
console.log('done')
