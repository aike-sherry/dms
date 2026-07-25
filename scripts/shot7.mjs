// 验证：双端 HOME 实时统计（含归档后的联动）
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

async function newPage(role, hash) {
  const page = await browser.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate((r) => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: r })), role)
  await page.goto(`${BASE}/?s=1#${hash}`, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1400))
  return page
}

// 1. PM HOME（归档操作前）
let page = await newPage('pm', '/home')
await page.screenshot({ path: `${OUT}verify7-pm-home.png`, fullPage: true })
console.log('saved pm-home')

// 2. PM 去 REVIEW 归档一个文件，再回 HOME 看数字变化
await page.evaluate(() => {
  for (const el of document.querySelectorAll('nav button, nav a, aside button, aside a')) {
    if ((el.textContent || '').trim().includes('REVIEW')) { el.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 900))
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tr')) {
    if ((tr.textContent || '').includes('伦理递交信–上海瑞金医院')) {
      const link = [...tr.querySelectorAll('a,button,span')].find((b) => (b.textContent || '').trim() === '归档')
      if (link) { link.click(); return }
    }
  }
})
await new Promise((r) => setTimeout(r, 800))
await page.evaluate(() => {
  for (const el of document.querySelectorAll('nav button, nav a, aside button, aside a')) {
    if ((el.textContent || '').trim().includes('HOME')) { el.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 1200))
await page.screenshot({ path: `${OUT}verify7-pm-home-after.png`, fullPage: true })
console.log('saved pm-home-after')
await page.close()

// 3. 执行端 HOME
page = await newPage('executor', '/home')
await page.screenshot({ path: `${OUT}verify7-ex-home.png`, fullPage: true })
console.log('saved ex-home')
await page.close()

await browser.close()
