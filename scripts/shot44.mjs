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
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'admin' }))
})
await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(4000)

// 点击 ON101 健康度卡片（第 3 张）打开下钻弹窗
await page.evaluate(() => {
  const cards = [...document.querySelectorAll('[role="button"]')]
  const target = cards.find((c) => c.textContent.includes('ON101'))
  target?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(1200)
await page.screenshot({ path: `${OUT}\\44-admin-drill.png` })

await browser.close()
console.log('done')
