// 验证：执行端 TRANSFER 新建文件夹重命名 + SITE TMF 临床监查员列
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

// 1) TRANSFER：点「新建」→ 文件夹进入命名状态
await page.goto(`${BASE}/?s=1#/transfer`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if ((btn.textContent || '').trim().includes('新建')) { btn.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 600))
// 输入新名称
await page.evaluate(() => {
  const input = document.querySelector('tbody input')
  if (!input) return
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, 'ON101–伦理批件–202507')
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 300))
await page.screenshot({ path: `${OUT}verify16-renaming.png`, fullPage: true })
console.log('saved renaming')
// 回车确认
await page.keyboard.press('Enter')
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: `${OUT}verify16-renamed.png`, fullPage: true })
console.log('saved renamed')

// 2) SITE TMF：临床监查员列
await page.goto(`${BASE}/?s=2#/site`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))
await page.screenshot({ path: `${OUT}verify16-site.png`, fullPage: true })
console.log('saved site')

await browser.close()
