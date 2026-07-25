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

// 登录页（含 admin 演示账号提示）
await page.goto(BASE, { waitUntil: 'networkidle0' })
await sleep(800)
await page.screenshot({ path: `${OUT}\\42-login.png` })

// admin 登录态
await page.evaluate(() => {
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'admin' }))
})

async function shot(hash, name) {
  await page.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle0' })
  await page.reload({ waitUntil: 'networkidle0' })
  await sleep(1200)
  await page.screenshot({ path: `${OUT}\\${name}.png` })
}

await shot('/dashboard', '42-admin-dashboard')
await shot('/accounts', '42-admin-accounts')
await shot('/customers', '42-admin-customers')

await browser.close()
console.log('done')
