// 验证：首页筛选器真实过滤
import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] || 'http://localhost:5199'
const OUT = fileURLToPath(new URL('../../shots/', import.meta.url))
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  defaultViewport: { width: 1680, height: 1600 },
})

const page = await browser.newPage()
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' })))
await page.goto(`${BASE}/?s=1#/home`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 3500))

// 统计汇总：项目选 ON102（无数据），中心选江苏大学附属医院
await page.evaluate(() => {
  const sels = document.querySelectorAll('select')
  // 找到统计汇总卡片内的两个 select（页面上第 3、4 个）
  const summary = [...document.querySelectorAll('select')]
  // 按顺序：donut 项目、site卡 项目、汇总 项目、汇总 中心
  const setVal = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    setter.call(el, v)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  setVal(summary[2], 'ON102')
  setVal(summary[3], '江苏大学附属医院')
})
await new Promise((r) => setTimeout(r, 1000))
await page.screenshot({ path: `${OUT}verify8-filtered.png`, fullPage: true })
console.log('saved filtered')

// 恢复全部
await page.evaluate(() => {
  const summary = [...document.querySelectorAll('select')]
  const setVal = (el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
    setter.call(el, v)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  setVal(summary[2], '全部')
  setVal(summary[3], '全部')
})
await new Promise((r) => setTimeout(r, 1000))
await page.screenshot({ path: `${OUT}verify8-all.png`, fullPage: true })
console.log('saved all')
await browser.close()
