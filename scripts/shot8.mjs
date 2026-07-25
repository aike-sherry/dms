// 复拍执行端 HOME（延长等待，排除 ResponsiveContainer 布局时序）
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
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'executor' })))
await page.goto(`${BASE}/?s=1#/home`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 3500))
// 检查柱状图 DOM 是否渲染
const info = await page.evaluate(() => {
  const bars = document.querySelectorAll('.recharts-bar-rectangle').length
  const svg = document.querySelectorAll('.recharts-surface').length
  return { bars, svg }
})
console.log('recharts info:', JSON.stringify(info))
await page.screenshot({ path: `${OUT}verify7-ex-home.png`, fullPage: true })
console.log('saved ex-home')
await browser.close()
