// 一次性视觉验证脚本：预设登录态后截取关键页面
import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] || 'http://localhost:5199'
const OUT = fileURLToPath(new URL('../../shots/', import.meta.url))
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--window-size=1680,1200', '--force-device-scale-factor=1'],
  defaultViewport: { width: 1680, height: 1200 },
})

async function shotAs(role, hash, name, action) {
  const page = await browser.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate((r) => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: r })), role)
  await page.goto(`${BASE}/?s=1#${hash}`, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1200))
  if (action) await action(page)
  await page.screenshot({ path: `${OUT}${name}.png` })
  console.log('saved', name)
  await page.close()
}

// 执行端：SUBMISSION 默认态（含"更新"按钮）
await shotAs('executor', '/submission', 'verify-ex-submission')
// 执行端：SUBMISSION 编辑模式（点击"更新"）
await shotAs('executor', '/submission', 'verify-ex-submission-editing', async (page) => {
  const btns = await page.$$('button')
  for (const b of btns) {
    const t = await b.evaluate((el) => el.textContent)
    if (t && t.includes('更新')) { await b.click(); break }
  }
  await new Promise((r) => setTimeout(r, 600))
})
// 执行端：首页（英文菜单大写验证）
await shotAs('executor', '/home', 'verify-ex-home')
// PM 端：SUBMISSION（同源数据只读验证）
await shotAs('pm', '/submission', 'verify-pm-submission')

await browser.close()
