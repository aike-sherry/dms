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

for (const role of ['pm', 'executor']) {
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate((r) => {
    sessionStorage.setItem('clinx-auth', JSON.stringify({ role: r }))
  }, role)
  await page.goto(`${BASE}/#/home`, { waitUntil: 'networkidle0' })
  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1100))
  await page.screenshot({ path: `${OUT}\\33-home-${role}.png` })
}

await browser.close()
console.log('done')
