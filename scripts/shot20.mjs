// 补验：PM 首页底部 Tab 的 SITE TMF 表（限定 gap-7 容器内的 Tab 按钮，避免点到侧边栏）
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
await page.goto(`${BASE}/?s=1#/home`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1800))
await page.evaluate(() => {
  const btn = document.querySelector('.gap-7 button:last-child')
  if (btn) btn.click()
})
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: `${OUT}verify20-home-site.png`, fullPage: true })
console.log('saved home-site')
await browser.close()
