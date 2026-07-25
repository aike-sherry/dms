// 验证：PM SUBMISSION 上传双渠道（本地 / STUDY TMF 引入）
import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] || 'http://localhost:5199'
const OUT = fileURLToPath(new URL('../../shots/', import.meta.url))
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  defaultViewport: { width: 1680, height: 1400 },
})

const page = await browser.newPage()
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' })))
await page.goto(`${BASE}/?s=1#/submission`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))

// 1) 点「上传」→ 弹窗本地上传 tab
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if ((btn.textContent || '').trim() === '上传') { btn.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 800))
await page.screenshot({ path: `${OUT}verify21-local.png` })
console.log('saved local')

// 2) 切到「从 STUDY TMF 选择」→ 选目录 ON101CLCT06 → 勾选两个文件
await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]')
  for (const btn of dialog.querySelectorAll('button')) {
    if ((btn.textContent || '').includes('从 STUDY TMF 选择')) { btn.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 500))
await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]')
  for (const btn of dialog.querySelectorAll('button')) {
    if ((btn.textContent || '').includes('ON101CLCT06')) { btn.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 500))
await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]')
  const boxes = [...dialog.querySelectorAll('input[type="checkbox"]')]
  boxes.slice(0, 2).forEach((b) => b.click())
})
await new Promise((r) => setTimeout(r, 400))
await page.screenshot({ path: `${OUT}verify21-tmf.png` })
console.log('saved tmf')

// 3) 确认引入 → toast + 递交文件表新增两行
await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]')
  for (const btn of dialog.querySelectorAll('button')) {
    if ((btn.textContent || '').includes('确认引入')) { btn.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 900))
await page.screenshot({ path: `${OUT}verify21-done.png`, fullPage: true })
console.log('saved done')

await browser.close()
