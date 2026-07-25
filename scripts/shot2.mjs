// 本轮功能验证截图：Transfer 状态列/驳回弹窗、SUBMISSION 日期选择器/文件夹弹窗
import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] || 'http://localhost:5199'
const OUT = fileURLToPath(new URL('../../shots/', import.meta.url))
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  defaultViewport: { width: 1680, height: 1200 },
})

async function newPage(role, hash) {
  const page = await browser.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate((r) => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: r })), role)
  await page.goto(`${BASE}/?s=1#${hash}`, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1200))
  return page
}

async function clickByText(page, selector, text) {
  const els = await page.$$(selector)
  for (const el of els) {
    const t = await el.evaluate((e) => e.textContent || '')
    if (t.includes(text)) { await el.click(); return true }
  }
  return false
}

// 1. 执行端 Transfer：智能处理/状态列 + 驳回徽标
let page = await newPage('executor', '/transfer')
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: `${OUT}verify2-ex-transfer.png` })
console.log('saved verify2-ex-transfer')

// 2. 点击"驳回"徽标 → 驳回原因弹窗
await clickByText(page, 'button', '驳回')
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: `${OUT}verify2-ex-reject-dialog.png` })
console.log('saved verify2-ex-reject-dialog')
await page.close()

// 3. 执行端 SUBMISSION：更新模式 + 打开日历选择器
page = await newPage('executor', '/submission')
await clickByText(page, 'button', '更新')
await new Promise((r) => setTimeout(r, 500))
await clickByText(page, 'button', '选择日期')
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: `${OUT}verify2-ex-datepicker.png` })
console.log('saved verify2-ex-datepicker')
await page.close()

// 4. 点击文件夹名称 → 文件夹内容弹窗
page = await newPage('executor', '/submission')
await clickByText(page, 'button', '研究方案及递交资料')
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: `${OUT}verify2-ex-folder-dialog.png` })
console.log('saved verify2-ex-folder-dialog')
await page.close()

await browser.close()
