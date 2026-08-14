import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5199'
const OUT = 'C:\\Users\\huawe\\Documents\\Kimi\\Workspaces\\ClinicalTrialsDocumentM\\shots'
const TMP = 'C:\\Users\\huawe\\Documents\\Kimi\\Workspaces\\ClinicalTrialsDocumentM\\tmp-upload'
const FILES = [`${TMP}\\知情同意书V2_20260301.pdf`, `${TMP}\\伦理批件-瑞金.pdf`, `${TMP}\\随便起名123.pdf`]

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  defaultViewport: { width: 1600, height: 1000 },
})
const page = await browser.newPage()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* 执行端登录并上传 3 个测试文件 */
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'executor' }))
  localStorage.removeItem('clinx-data-v2')
})
await page.goto(`${BASE}/#/transfer`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '上传')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(800)
await page.evaluate(() => {
  const sel = document.querySelector('[role="dialog"]')?.querySelector('select')
  if (sel) {
    sel.value = 'ON101CL01'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  }
})
await sleep(300)
const input = await page.$('[role="dialog"] input[type="file"]')
await input.uploadFile(...FILES)
await sleep(1500)

/* 提交刚上传并自动命名的「知情同意书 V1.0（2026-03-01）」（精确匹配新名，避开种子文件） */
await page.evaluate(() => {
  const row = [...document.querySelectorAll('tr')].find((r) => r.textContent.includes('知情同意书 V1.0（2026-03-01）'))
  const btn = [...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === '提交')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(1500)

/* ② PM 端 REVIEW 显示规范名 */
await page.evaluate(() => {
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' }))
})
await page.goto(`${BASE}/#/review`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)
await page.screenshot({ path: `${OUT}\\49-pm-review-names.png` })

await browser.close()
console.log('done')
