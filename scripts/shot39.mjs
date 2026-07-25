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
  await new Promise((r) => setTimeout(r, 800))
}

async function shot(hash, name) {
  await page.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle0' })
  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1000))
  await pickProject('ON102')
  await page.screenshot({ path: `${OUT}\\${name}.png` })
}

await login('executor', '/home')
await pickProject('ON102')
await page.screenshot({ path: `${OUT}\\39-ex-home-on102.png` })

await shot('/site', '39-ex-site-on102')
await shot('/transfer', '39-ex-transfer-on102')
await shot('/submission', '39-ex-submission-on102')

await browser.close()
console.log('done')
