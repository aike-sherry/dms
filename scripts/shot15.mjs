// 验证：SITE TMF 管理临床监查员列 + SUBMISSION 取消选择按钮
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

// 1) 管理端 SITE TMF：临床监查员列
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' })))
await page.goto(`${BASE}/?s=1#/site`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
await page.screenshot({ path: `${OUT}verify15-site-tmf.png`, fullPage: true })
console.log('saved site-tmf')

// 2) 执行端 SUBMISSION：勾选后显示「取消选择」
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'executor' })))
await page.goto(`${BASE}/?s=2#/submission`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
await page.evaluate(() => {
  const boxes = [...document.querySelectorAll('tbody input[type="checkbox"]')]
  boxes.slice(0, 2).forEach((b) => b.click())
})
await new Promise((r) => setTimeout(r, 500))
await page.screenshot({ path: `${OUT}verify15-cancel.png`, fullPage: true })
console.log('saved cancel')

await browser.close()
