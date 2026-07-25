// 验证：PM Transfer 文件夹、REVIEW 文件夹审核、全局居中
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

async function newPage(role, hash) {
  const page = await browser.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate((r) => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: r })), role)
  await page.goto(`${BASE}/?s=1#${hash}`, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1200))
  return page
}

async function clickByText(page, selector, text) {
  for (const el of await page.$$(selector)) {
    const t = await el.evaluate((e) => e.textContent || '')
    if (t.includes(text)) { await el.click(); return true }
  }
  return false
}

// 1. PM Transfer 主列表（居中 + 文件夹行）
let page = await newPage('pm', '/transfer')
await page.screenshot({ path: `${OUT}verify4-pm-transfer.png` })
console.log('saved pm-transfer')

// 2. 打开文件夹（钻取视图）
await clickByText(page, 'button', 'ON101–研究文档')
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: `${OUT}verify4-pm-transfer-folder.png` })
console.log('saved pm-transfer-folder')
await page.close()

// 3. PM REVIEW：文件夹行 → 审核弹窗
page = await newPage('pm', '/review')
await page.screenshot({ path: `${OUT}verify4-pm-review.png` })
// 点击“安全性报告”文件夹行内的审核按钮
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tr')) {
    if ((tr.textContent || '').includes('安全性报告')) {
      const btn = [...tr.querySelectorAll('button')].find((b) => (b.textContent || '').includes('审核'))
      if (btn) { btn.click(); return }
    }
  }
})
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: `${OUT}verify4-pm-review-folder.png` })
console.log('saved pm-review + folder dialog')
await page.close()

// 4. 执行端 Transfer 居中复查
page = await newPage('executor', '/transfer')
await page.screenshot({ path: `${OUT}verify4-ex-transfer.png` })
console.log('saved ex-transfer')
await page.close()

await browser.close()
