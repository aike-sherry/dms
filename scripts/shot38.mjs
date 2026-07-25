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

async function pickProject(value) {
  await page.evaluate((v) => {
    const sel = document.querySelector('header select')
    if (sel) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
      setter.call(sel, v)
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, value)
  await new Promise((r) => setTimeout(r, 700))
}

// 1. PM STUDY TMF 选 ON102
await login('pm', '/study')
await pickProject('ON102')
await page.screenshot({ path: `${OUT}\\38-study-on102.png` })

// 2. PM TRANSFER 选 ON102
await login('pm', '/transfer')
await pickProject('ON102')
await page.screenshot({ path: `${OUT}\\38-transfer-on102.png` })

// 3. 首页选 ON102
await login('pm', '/home')
await pickProject('ON102')
await page.screenshot({ path: `${OUT}\\38-home-on102.png` })

await browser.close()
console.log('done')
