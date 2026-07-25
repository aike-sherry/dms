// 复查：执行端 Transfer 文件夹不再重复显示子文件，且可钻取
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
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'executor' })))
await page.goto(`${BASE}/?s=1#/transfer`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1200))
await page.screenshot({ path: `${OUT}verify5-ex-transfer.png` })
console.log('saved ex-transfer')

// 点击文件夹名钻取
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('td button')) {
    if ((btn.textContent || '').includes('安全性报告')) { btn.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: `${OUT}verify5-ex-transfer-folder.png` })
console.log('saved ex-transfer-folder')

await browser.close()
