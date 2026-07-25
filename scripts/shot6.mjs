// 补拍：SITE TMF 瑞金医院目录钻取 + 打开归档文件夹
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

const page = await browser.newPage()
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' })))
await page.goto(`${BASE}/?s=1#/review`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1200))

// REVIEW 归档文件夹 f10
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tr')) {
    if ((tr.textContent || '').includes('安全性报告')) {
      const link = [...tr.querySelectorAll('a,button,span')].find((b) => (b.textContent || '').trim() === '归档')
      if (link) { link.click(); return }
    }
  }
})
await new Promise((r) => setTimeout(r, 800))

// 应用内导航到 SITE TMF
await page.evaluate(() => {
  for (const el of document.querySelectorAll('nav button, nav a, aside button, aside a')) {
    if ((el.textContent || '').trim().includes('SITE TMF')) { el.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 800))

// 点击目录行（含 SITE TMF —上海瑞金医院 的行）
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tr')) {
    if ((tr.textContent || '').includes('SITE TMF —上海瑞金医院')) { tr.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: `${OUT}verify6-site-tmf-drill.png` })
console.log('saved site-tmf-drill')

// 打开归档文件夹看级联子文件
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('td button')) {
    if ((btn.textContent || '').includes('安全性报告')) { btn.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: `${OUT}verify6-site-tmf-subfolder.png` })
console.log('saved site-tmf-subfolder')
await page.close()
await browser.close()
