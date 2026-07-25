// 验证：PM 首页 CRA 分配模块（分配 → 首页 SITE 表联动 → 执行端联动）
import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] || 'http://localhost:5199'
const OUT = fileURLToPath(new URL('../../shots/', import.meta.url))
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  defaultViewport: { width: 1680, height: 1400 },
})
const page = await browser.newPage()
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  localStorage.clear()
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' }))
})
await page.goto(`${BASE}/?s=3#/home`, { waitUntil: 'networkidle0' })
await sleep(1500)

// 1) 滚到 CRA 分配卡 → 截图（三个中心，操作列：更换/更换/分配）
await page.evaluate(() => {
  for (const el of document.querySelectorAll('*')) {
    if (el.children.length === 0 && el.textContent?.trim() === '研究中心 CRA 分配') {
      el.scrollIntoView({ block: 'start' })
      return
    }
  }
})
await sleep(600)
await page.screenshot({ path: `${OUT}verify23-1-card.png` })
console.log('1 card visible:', await page.evaluate(() => document.body.textContent.includes('研究中心 CRA 分配')))

// 2) 江苏大学附属医院行点「更换」→ 弹窗 → 改为「陈明」→ 确认分配
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tr')) {
    if ((tr.textContent || '').includes('江苏大学附属医院')) {
      for (const el of tr.querySelectorAll('button, a, span')) {
        if ((el.textContent || '').trim() === '更换') { el.click(); return }
      }
    }
  }
})
await sleep(600)
await page.evaluate(() => {
  const input = document.querySelector('[role="dialog"] input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, '陈明')
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(300)
await page.screenshot({ path: `${OUT}verify23-2-dialog.png` })
console.log('2 dialog')
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('[role="dialog"] button')) {
    if ((btn.textContent || '').includes('确认分配')) { btn.click(); return }
  }
})
await sleep(900)
await page.screenshot({ path: `${OUT}verify23-3-assigned.png` })
console.log('3 assigned:', await page.evaluate(() => document.body.textContent.includes('陈明')))

// 3) 底部 tabs 切到 SITE TMF → 江苏行 CRA 列联动为陈明
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter((b) => (b.textContent || '').trim() === 'SITE TMF')
  const tab = btns[btns.length - 1]
  if (tab) { tab.scrollIntoView({ block: 'center' }); tab.click() }
})
await sleep(800)
await page.screenshot({ path: `${OUT}verify23-4-site-tab.png` })
console.log('4 site tab linked')

// 4) 执行端首页联动：江苏行 CRA 列显示陈明
await page.goto(`${BASE}/?s=4`, { waitUntil: 'networkidle0' })
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'executor' })))
await page.goto(`${BASE}/?s=5#/home`, { waitUntil: 'networkidle0' })
await sleep(1500)
await page.screenshot({ path: `${OUT}verify23-5-exhome.png` })
console.log('5 executor home linked:', await page.evaluate(() => document.body.textContent.includes('陈明')))

await browser.close()
