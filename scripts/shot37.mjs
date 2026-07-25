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

async function login(role, hash) {
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate((r) => {
    sessionStorage.setItem('clinx-auth', JSON.stringify({ role: r }))
  }, role)
  await page.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle0' })
  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1000))
}

// 1. STUDY TMF 工具栏（按钮应在右侧）
await login('pm', '/study')
await page.screenshot({ path: `${OUT}\\37-tmf-toolbar.png` })

// 2. 顶部选择 ON102 后看 STUDY TMF 过滤效果
await page.evaluate(() => {
  const sel = document.querySelector('header select')
  if (sel) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    setter.call(sel, 'ON102')
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  }
})
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: `${OUT}\\37-study-on102.png` })

// 3. 首页联动
await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 900))
await page.screenshot({ path: `${OUT}\\37-home-on102.png` })

await browser.close()
console.log('done')
