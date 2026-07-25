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

// 执行端 SUBMISSION 选 ON102
await login('executor', '/submission')
await pickProject('ON102')
await page.screenshot({ path: `${OUT}\\40-ex-sub-on102.png` })

// 点击 ON102 文件夹行 → 钻取查看文件夹内文件
await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td')]
  const td = tds.find((t) => t.textContent.includes('伦理递交资料包'))
  const row = td?.closest('tr')
  row?.querySelector('td')?.click()
  row?.click()
})
await sleep(1000)
await page.screenshot({ path: `${OUT}\\40-ex-sub-folder.png` })

// 返回并打开「更新」弹窗
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  btns.find((b) => b.textContent.includes('返回'))?.click()
})
await sleep(800)
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  btns.find((b) => b.textContent.replace(/\s/g, '').includes('更新'))?.click()
})
await sleep(1000)
await page.screenshot({ path: `${OUT}\\40-ex-sub-update.png` })

await browser.close()
console.log('done')
