// 验证：执行端 TRANSFER 临床监查员列 + 管理端 SUBMISSION 勾选下载
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

// 1) 执行端 TRANSFER：临床监查员列
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'executor' })))
await page.goto(`${BASE}/?s=1#/transfer`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
await page.screenshot({ path: `${OUT}verify14-ex-transfer.png`, fullPage: true })
console.log('saved ex-transfer')

// 2) 管理端 SUBMISSION：勾选两个文件
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' })))
await page.goto(`${BASE}/?s=2#/submission`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('tbody input[type="checkbox"]')]
  boxes.slice(0, 2).forEach((b) => b.click())
})
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: `${OUT}verify14-pm-submission.png`, fullPage: true })
console.log('saved pm-submission')

// 3) 管理端文件夹弹窗勾选
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('td button')) {
    if ((btn.getAttribute('title') || '') === '点击打开文件夹') { btn.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 800))
await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]')
  if (!dialog) return
  const boxes = [...dialog.querySelectorAll('tbody input[type="checkbox"]')]
  boxes.slice(0, 2).forEach((b) => b.click())
})
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: `${OUT}verify14-pm-folder.png`, fullPage: true })
console.log('saved pm-folder')

await browser.close()
