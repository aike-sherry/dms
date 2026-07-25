// 验证：归档后整页刷新，数据仍保留（localStorage 持久化）
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
// 清掉旧持久化数据，从种子开始
await page.evaluate(() => {
  localStorage.removeItem('clinx-data-v1')
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' }))
})
await page.goto(`${BASE}/?s=1#/review`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1200))

// 归档 f3（伦理递交信–上海瑞金医院）
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tr')) {
    if ((tr.textContent || '').includes('伦理递交信–上海瑞金医院')) {
      const link = [...tr.querySelectorAll('a,button,span')].find((b) => (b.textContent || '').trim() === '归档')
      if (link) { link.click(); return }
    }
  }
})
await new Promise((r) => setTimeout(r, 800))
await page.screenshot({ path: `${OUT}verify9-before-reload.png` })
console.log('saved before-reload')

// 整页刷新（不带查询参数也会重载），验证归档结果仍在
await page.goto(`${BASE}/?s=2#/review`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
await page.screenshot({ path: `${OUT}verify9-after-reload.png` })
console.log('saved after-reload')

const persisted = await page.evaluate(() => {
  const raw = localStorage.getItem('clinx-data-v1')
  if (!raw) return null
  const d = JSON.parse(raw)
  return { files: d.files.length, archived: d.files.filter((f) => f.status === 'archived').length }
})
console.log('persisted:', JSON.stringify(persisted))
await browser.close()
