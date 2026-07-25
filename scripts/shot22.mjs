// 验证：PM TRANSFER 智能命名 / 智能纠错 / 归档全流程
import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.argv[2] || 'http://localhost:5199'
const OUT = fileURLToPath(new URL('../../shots/', import.meta.url))
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

// 准备命名不规范的本地测试文件（连续空格 + 中文日期）
const TMP_DIR = fileURLToPath(new URL('../../tmp-upload/', import.meta.url))
fs.mkdirSync(TMP_DIR, { recursive: true })
const TMP_FILE = path.join(TMP_DIR, 'protocol  final  v2.0 2024年3月5日.pdf')
fs.writeFileSync(TMP_FILE, '%PDF-1.4 demo')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
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
/* 在包含 rowKey 的表格行中点击指定文本的链接/按钮 */
const clickInRow = (page, rowKey, linkText) =>
  page.evaluate(
    ({ rk, lt }) => {
      for (const tr of document.querySelectorAll('tr')) {
        if ((tr.textContent || '').includes(rk)) {
          for (const el of tr.querySelectorAll('button, a, span')) {
            if ((el.textContent || '').trim() === lt) { el.click(); return true }
          }
        }
      }
      return false
    },
    { rk: rowKey, lt: linkText },
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
await page.goto(`${BASE}/?s=2#/transfer`, { waitUntil: 'networkidle0' })
await sleep(1500)

// 1) 上传命名不规范的本地文件
await clickBtn(page, '上传')
await sleep(700)
await page.select('[role="dialog"] select', 'ON101CL103')
await sleep(300)
const [fileInput] = await page.$$('[role="dialog"] input[type="file"]')
await fileInput.uploadFile(TMP_FILE)
await sleep(1200)
await page.screenshot({ path: `${OUT}verify22-1-uploaded.png` })
console.log('1 uploaded row visible:', await page.evaluate(() => document.body.textContent.includes('protocol')))

// 2) 该行点「智能纠错」→ 问题清单弹窗
await clickInRow(page, 'protocol', '智能纠错')
await sleep(700)
await page.screenshot({ path: `${OUT}verify22-2-correct.png` })
console.log('2 correct dialog')

// 3) 一键修复 → 文件名规范化 + toast
await clickBtn(page, '一键修复', '[role="dialog"]')
await sleep(1000)
await page.screenshot({ path: `${OUT}verify22-3-fixed.png` })
console.log('3 fixed, renamed:', await page.evaluate(() => document.body.textContent.includes('研究方案 V2.0（2024-03-05）')))

// 4) 修复后的行点「智能命名」→ 识别结果弹窗
await clickInRow(page, '研究方案 V2.0', '智能命名')
await sleep(700)
await page.screenshot({ path: `${OUT}verify22-4-rename.png` })
console.log('4 rename dialog')

// 5) 应用命名 → 再点该行「归档」→ toast 归档至 STUDY TMF
await clickBtn(page, '应用命名', '[role="dialog"]')
await sleep(800)
await clickInRow(page, '研究方案 V2.0', '归档')
await sleep(1000)
await page.screenshot({ path: `${OUT}verify22-5-archived.png` })
console.log('5 archived toast:', await page.evaluate(() => document.body.textContent.includes('STUDY TMF')))

await browser.close()
