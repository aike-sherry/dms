// 验证：上传弹窗新视觉 + 文件夹钻取视图内删除子文件
import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.argv[2] || 'http://localhost:5199'
const OUT = fileURLToPath(new URL('../../shots/', import.meta.url))
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const TMP = fileURLToPath(new URL('../../tmp-upload/', import.meta.url))
fs.mkdirSync(TMP, { recursive: true })
fs.writeFileSync(path.join(TMP, '方案终稿.pdf'), '%PDF demo')

const clickBtn = (page, match, scope = '') =>
  page.evaluate(
    ({ m, s }) => {
      const root = s ? document.querySelector(s) : document
      if (!root) return false
      for (const btn of root.querySelectorAll('button')) {
        if ((btn.textContent || '').trim().includes(m)) { btn.click(); return true }
      }
      return false
    },
    { m: match, s: scope },
  )

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  defaultViewport: { width: 1680, height: 1400 },
})
const page = await browser.newPage()
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  localStorage.clear()
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' }))
})
await page.goto(`${BASE}/?s=10#/transfer`, { waitUntil: 'networkidle0' })
await sleep(1500)

// 1) 打开上传弹窗 → 新视觉截图（未选编号时的琥珀色提示 + 双卡片）
await clickBtn(page, '上传')
await sleep(700)
await page.screenshot({ path: `${OUT}verify26-1-dialog.png` })
console.log('1 dialog visible:', await page.evaluate(() => document.body.textContent.includes('上传文件夹')))

// 2) 选编号 → 通过卡片入口上传文件
await page.select('[role="dialog"] select', 'ON101CL103')
await sleep(200)
await clickBtn(page, '上传文件', '[role="dialog"]')
await sleep(300)
const [fileInput] = await page.$$('[role="dialog"] input[type="file"]')
await fileInput.uploadFile(path.join(TMP, '方案终稿.pdf'))
await sleep(1000)
console.log('2 uploaded via card:', await page.evaluate(() => document.body.textContent.includes('方案终稿.pdf')))

// 3) 打开种子文件夹「ON101–研究文档」→ 钻取视图（含删除按钮）
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tr')) {
    if ((tr.textContent || '').includes('ON101–研究文档')) {
      for (const btn of tr.querySelectorAll('button')) {
        if ((btn.textContent || '').trim() === 'ON101–研究文档') { btn.click(); return }
      }
    }
  }
})
await sleep(800)
await page.screenshot({ path: `${OUT}verify26-2-folder.png` })
console.log('3 folder opened, child visible:', await page.evaluate(() => document.body.textContent.includes('ON101–研究方案–3.0–20250710')))

// 4) 钻取视图内删除：进入删除模式 → 勾选子文件 → 确认删除 → 空态
await clickBtn(page, '删除')
await sleep(500)
const boxes = await page.$$('tbody input[type="checkbox"]')
if (boxes[0]) await boxes[0].click()
await sleep(300)
await page.screenshot({ path: `${OUT}verify26-3-delmode.png` })
await clickBtn(page, '确认删除')
await sleep(900)
await page.screenshot({ path: `${OUT}verify26-4-deleted.png` })
console.log('4 deleted, empty state:', await page.evaluate(() => document.body.textContent.includes('文件夹内暂无文件')))

await browser.close()
