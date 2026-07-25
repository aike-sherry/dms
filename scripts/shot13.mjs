// 验证：新版日期选择器样式 + 选择性下载
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
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'executor' })))
await page.goto(`${BASE}/?s=1#/submission`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))

const clickBtnByText = (text) =>
  page.evaluate((t) => {
    for (const btn of document.querySelectorAll('button')) {
      if ((btn.textContent || '').trim().includes(t)) { btn.click(); return true }
    }
    return false
  }, text)

// 1) 点「更新」→ 打开日历面板截图
await clickBtnByText('更新')
await new Promise((r) => setTimeout(r, 600))
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('td button')) {
    const t = btn.textContent || ''
    if (t.includes('选择日期') || /\d{4}-\d{2}-\d{2}/.test(t)) { btn.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 800))
await page.screenshot({ path: `${OUT}verify13-calendar.png`, fullPage: true })
console.log('saved calendar')

// 关闭弹层并取消编辑
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 400))
await clickBtnByText('取消')
await new Promise((r) => setTimeout(r, 400))

// 2) 勾选前两个文件 → 「下载 所选（2）」按钮截图
await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('tbody input[type="checkbox"]')]
  boxes.slice(0, 2).forEach((b) => b.click())
})
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: `${OUT}verify13-selected.png`, fullPage: true })
console.log('saved selected')

// 3) 点击「下载 所选」→ toast 截图
await clickBtnByText('下载 所选')
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: `${OUT}verify13-toast.png` })
console.log('saved toast')

// 4) 打开文件夹弹窗，勾选部分文件截图
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
await page.screenshot({ path: `${OUT}verify13-folder.png`, fullPage: true })
console.log('saved folder')

await browser.close()
