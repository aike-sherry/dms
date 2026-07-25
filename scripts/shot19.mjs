// 验证：PM 首页 STUDY/SITE 两个 Tab 新列 + 执行端首页 CRA 列
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

// 1) PM 首页 STUDY TMF tab（默认）
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' })))
await page.goto(`${BASE}/?s=1#/home`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1800))
await page.screenshot({ path: `${OUT}verify19-pm-study.png`, fullPage: true })
console.log('saved pm-study')

// 2) PM 首页点 SITE TMF tab
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if ((btn.textContent || '').trim() === 'SITE TMF') { btn.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: `${OUT}verify19-pm-site.png`, fullPage: true })
console.log('saved pm-site')

// 3) 执行端首页
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'executor' })))
await page.goto(`${BASE}/?s=2#/home`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1800))
await page.screenshot({ path: `${OUT}verify19-ex-home.png`, fullPage: true })
console.log('saved ex-home')

await browser.close()
