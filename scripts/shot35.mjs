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

async function login(role, hash) {
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate((r) => {
    sessionStorage.setItem('clinx-auth', JSON.stringify({ role: r }))
  }, role)
  await page.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle0' })
  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1000))
}

// 1. PM 首页：环比徽章
await login('pm', '/home')
await page.screenshot({ path: `${OUT}\\35-home-trend.png` })

// 2. PM TRANSFER：名称左对齐 + 星标在右
await login('pm', '/transfer')
await page.screenshot({ path: `${OUT}\\35-transfer-left.png` })

// 3. PM STUDY TMF 钻取：文件行星标在右
await login('pm', '/study')
await page.evaluate(() => {
  const row = [...document.querySelectorAll('tbody tr')].find((r) =>
    r.textContent.includes('STUDY TMF'),
  )
  row?.click()
})
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: `${OUT}\\35-study-drill.png` })

await browser.close()
console.log('done')
