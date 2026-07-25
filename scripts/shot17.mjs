// 验证：文件行星标收藏 + 收藏页派生 + 文件夹无星标
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

// 1) 执行端 TRANSFER：星标出现在文件行（文件夹行没有）
await page.goto(`${BASE}/?s=1#/transfer`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
await page.screenshot({ path: `${OUT}verify17-stars.png`, fullPage: true })
console.log('saved stars')

// 2) 点第一个星标收藏 → toast
await page.evaluate(() => {
  const btn = document.querySelector('tbody button[title="收藏"]')
  if (btn) btn.click()
})
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: `${OUT}verify17-faved.png`, fullPage: true })
console.log('saved faved')

// 3) FAVORITE 页：种子收藏 + 新收藏
await page.goto(`${BASE}/?s=2#/favorite`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
await page.screenshot({ path: `${OUT}verify17-favpage.png`, fullPage: true })
console.log('saved favpage')

// 4) PM STUDY TMF 钻取：归档文件带星标
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' })))
await page.goto(`${BASE}/?s=3#/study`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
await page.evaluate(() => {
  const row = document.querySelector('tbody tr')
  if (row) row.click()
})
await new Promise((r) => setTimeout(r, 1000))
await page.screenshot({ path: `${OUT}verify17-study-drill.png`, fullPage: true })
console.log('saved study-drill')

await browser.close()
