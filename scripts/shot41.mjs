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

async function login(role, hash) {
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate((r) => {
    sessionStorage.setItem('clinx-auth', JSON.stringify({ role: r }))
  }, role)
  await page.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle0' })
  await page.reload({ waitUntil: 'networkidle0' })
  await sleep(1000)
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
  await sleep(800)
}

async function shot(hash, name) {
  await page.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle0' })
  await page.reload({ waitUntil: 'networkidle0' })
  await sleep(1000)
  await pickProject('ON103')
  await page.screenshot({ path: `${OUT}\\${name}.png` })
}

await login('pm', '/study')
await pickProject('ON103')
await page.screenshot({ path: `${OUT}\\41-pm-study-on103.png` })
await shot('/site', '41-pm-site-on103')

// 执行端（张兰）SUBMISSION 选 ON103
await login('executor', '/submission')
await pickProject('ON103')
await page.screenshot({ path: `${OUT}\\41-ex-sub-on103.png` })

await browser.close()
console.log('done')
