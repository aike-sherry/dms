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
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'executor' }))
})
await page.goto(`${BASE}/#/submission`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(1000)

// 选 ON102
await page.evaluate(() => {
  const sel = document.querySelector('header select')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  setter.call(sel, 'ON102')
  sel.dispatchEvent(new Event('change', { bubbles: true }))
})
await sleep(800)

// 点击 ON102 文件夹名按钮 → 打开钻取弹窗
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('td button')]
  btns.find((b) => b.textContent.includes('伦理递交资料包'))?.click()
})
await sleep(1000)
await page.screenshot({ path: `${OUT}\\40-ex-sub-folder.png` })

await browser.close()
console.log('done')
