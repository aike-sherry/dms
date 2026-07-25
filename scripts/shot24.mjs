// 验证：PM TRANSFER 上传优化（文件+文件夹 / 项目编号徽标 / 文件夹整体归档）
import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.argv[2] || 'http://localhost:5199'
const OUT = fileURLToPath(new URL('../../shots/', import.meta.url))
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 本地测试文件：一个 docx（验证文档类型不再被误判为文件夹）+ 一个待导入目录（含两个文件）
const TMP = fileURLToPath(new URL('../../tmp-upload/', import.meta.url))
fs.mkdirSync(path.join(TMP, '安全性报告'), { recursive: true })
fs.writeFileSync(path.join(TMP, 'SAE汇总报告.docx'), 'demo docx')
fs.writeFileSync(path.join(TMP, '安全性报告', 'SAE报告-1月.pdf'), '%PDF demo1')
fs.writeFileSync(path.join(TMP, '安全性报告', 'SAE报告-2月.pdf'), '%PDF demo2')

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
await page.goto(`${BASE}/?s=6#/transfer`, { waitUntil: 'networkidle0' })
await sleep(1500)

// 1) 上传弹窗：项目编号下拉为动态 STUDY 目录编号 → 截图
await clickBtn(page, '上传')
await sleep(700)
const optionCount = await page.evaluate(() => document.querySelectorAll('[role="dialog"] select option').length)
console.log('1 project options:', optionCount)
await page.select('[role="dialog"] select', 'ON101CL103')
await page.screenshot({ path: `${OUT}verify24-1-dialog.png` })

// 2) 导入 docx 文件 → 列表显示文档图标 + 项目编号徽标
const [fileInput] = await page.$$('[role="dialog"] input[type="file"]')
await fileInput.uploadFile(path.join(TMP, 'SAE汇总报告.docx'))
await sleep(1000)
await page.screenshot({ path: `${OUT}verify24-2-file.png` })
console.log('2 docx row visible:', await page.evaluate(() => document.body.textContent.includes('SAE汇总报告.docx')))

// 3) 再开弹窗导入文件夹（选不同编号 ON101CL01）→ 列表出现文件夹条目
await clickBtn(page, '上传')
await sleep(700)
await page.select('[role="dialog"] select', 'ON101CL01')
await sleep(200)
const dirInput = (await page.$$('[role="dialog"] input[type="file"]'))[1]
await dirInput.uploadFile(path.join(TMP, '安全性报告'))
await sleep(1000)
await page.screenshot({ path: `${OUT}verify24-3-dir.png` })
console.log('3 folder row visible:', await page.evaluate(() => document.body.textContent.includes('安全性报告')))

// 4) 打开该文件夹 → 查看两个子文件（子文件继承 ON101CL01 编号）
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tr')) {
    if ((tr.textContent || '').includes('安全性报告')) {
      for (const btn of tr.querySelectorAll('button')) {
        if ((btn.textContent || '').trim() === '安全性报告') { btn.click(); return }
      }
    }
  }
})
await sleep(800)
await page.screenshot({ path: `${OUT}verify24-4-children.png` })
console.log('4 children visible:', await page.evaluate(() => document.body.textContent.includes('SAE报告-1月.pdf')))

// 5) 返回顶层 → 点文件夹行的「归档」→ 整体归档 toast
await clickBtn(page, '返回')
await sleep(600)
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tr')) {
    if ((tr.textContent || '').includes('安全性报告')) {
      for (const btn of tr.querySelectorAll('button')) {
        if ((btn.textContent || '').trim() === '归档') { btn.click(); return }
      }
    }
  }
})
await sleep(1000)
await page.screenshot({ path: `${OUT}verify24-5-archived.png` })
console.log('5 archive toast:', await page.evaluate(() => document.body.textContent.includes('STUDY TMF')))

await browser.close()
