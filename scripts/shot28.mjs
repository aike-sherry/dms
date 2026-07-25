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
  // 仅 hash 变化不会触发整页重载，强制 reload 让应用重新读取登录态
  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 900))
}

async function clickButton(text) {
  return page.evaluate((t) => {
    const btns = [...document.querySelectorAll('button')]
    const b = btns.find((x) => x.textContent.trim().includes(t))
    if (b) { b.click(); return true }
    return false
  }, text)
}

// 1. PM STUDY TMF 下载选择模式
await login('pm', '/study')
await clickButton('下载')
await new Promise((r) => setTimeout(r, 500))
// 勾选前两个 checkbox
await page.evaluate(() => {
  const cbs = [...document.querySelectorAll('tbody input[type=checkbox]')]
  cbs.slice(0, 2).forEach((c) => c.click())
})
await new Promise((r) => setTimeout(r, 400))
await page.screenshot({ path: `${OUT}\\28-study-download-mode.png` })

// 2. 取消下载模式后打开 STUDY 创建目录弹窗，进入删除模式
await clickButton('取消')
await new Promise((r) => setTimeout(r, 400))
await clickButton('创建目录')
await new Promise((r) => setTimeout(r, 700))
await clickButton('删除')
await new Promise((r) => setTimeout(r, 400))
await page.evaluate(() => {
  const cbs = [...document.querySelectorAll('tbody input[type=checkbox]')]
  cbs.slice(0, 2).forEach((c) => c.click())
})
await new Promise((r) => setTimeout(r, 300))
await page.screenshot({ path: `${OUT}\\28-study-catalog-delmode.png` })

// 3. SITE TMF 弹窗（加宽版）
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 400))
await login('pm', '/site')
await clickButton('创建目录')
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: `${OUT}\\28-site-catalog-wide.png` })

// 4. 执行端 SITE TMF 下载模式
await page.keyboard.press('Escape')
await login('executor', '/site')
await clickButton('下载')
await new Promise((r) => setTimeout(r, 500))
await page.evaluate(() => {
  const cbs = [...document.querySelectorAll('tbody input[type=checkbox]')]
  cbs.slice(0, 1).forEach((c) => c.click())
})
await new Promise((r) => setTimeout(r, 300))
await page.screenshot({ path: `${OUT}\\28-exsite-download-mode.png` })

await browser.close()
console.log('done')
