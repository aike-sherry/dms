// 验证：设置菜单 → 重置演示数据（真实鼠标点击触发 Radix pointerdown）
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
page.on('dialog', (d) => d.accept())
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  localStorage.removeItem('clinx-data-v1')
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' }))
})
await page.goto(`${BASE}/?s=1#/review`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1200))

// 先归档 f3 制造脏数据（archived 2 → 3）
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tr')) {
    if ((tr.textContent || '').includes('伦理递交信–上海瑞金医院')) {
      const link = [...tr.querySelectorAll('a,button,span')].find((b) => (b.textContent || '').trim() === '归档')
      if (link) { link.click(); return }
    }
  }
})
await new Promise((r) => setTimeout(r, 800))

// 真实鼠标点击设置图标
const trigger = await page.$('header button:has(svg.lucide-settings)')
if (!trigger) { console.log('TRIGGER NOT FOUND'); process.exit(1) }
await trigger.click()
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: `${OUT}verify10-settings-menu.png` })
console.log('saved settings-menu')

// 真实鼠标点击「重置演示数据」菜单项
const item = await page.$('[role="menuitem"]')
if (!item) { console.log('MENU ITEM NOT FOUND'); process.exit(1) }
await item.click()
await new Promise((r) => setTimeout(r, 2500))
await page.screenshot({ path: `${OUT}verify10-after-reset.png` })
console.log('saved after-reset')

const state = await page.evaluate(() => {
  const raw = localStorage.getItem('clinx-data-v1')
  const d = raw ? JSON.parse(raw) : null
  return d ? { files: d.files.length, archived: d.files.filter((f) => f.status === 'archived').length } : null
})
console.log('after reset:', JSON.stringify(state), '（种子态应为 archived=2）')
await browser.close()
