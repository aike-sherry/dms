// 补验：PM SITE TMF 钻取上海瑞金医院 → 归档文件星标（f6/f7 种子已收藏应为实心）
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
await page.goto(`${BASE}/?s=1#/site`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
// 点击目录列表中「上海瑞金医院」所在行
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tbody tr')) {
    if ((tr.textContent || '').includes('SITE TMF') && (tr.textContent || '').includes('上海瑞金医院')) {
      tr.click()
      return
    }
  }
})
await new Promise((r) => setTimeout(r, 1000))
await page.screenshot({ path: `${OUT}verify18-site-drill.png`, fullPage: true })
console.log('saved site-drill')
await browser.close()
