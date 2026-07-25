// 验证：STUDY TMF 创建目录弹窗「上传目录」本地上传 Word/Excel → 文件随目录归档可见
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
fs.writeFileSync(path.join(TMP, '受试者随访计划.docx'), 'word demo')
fs.writeFileSync(path.join(TMP, '中心实验室正常值范围.xlsx'), 'excel demo')

const clickBtn = (page, match, scope = '') =>
  page.evaluate(
    ({ m, s }) => {
      const root = s ? document.querySelector(s) : document
      if (!root) return false
      for (const btn of root.querySelectorAll('button, a, span')) {
        if ((btn.textContent || '').trim() === m) { btn.click(); return true }
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
await page.goto(`${BASE}/?s=11#/study`, { waitUntil: 'networkidle0' })
await sleep(1500)

// 1) 创建目录弹窗 → 新建一行 → 填项目编号与文件夹名称
await clickBtn(page, '创建目录')
await sleep(700)
await clickBtn(page, '新建', '[role="dialog"]')
await sleep(400)
await page.type('[role="dialog"] input[placeholder="项目编号"]', 'ON101CL103')
await page.type('[role="dialog"] input[placeholder="文件夹名称"]', 'ON101CL103-随访管理文档')
await sleep(300)

// 2) 新建行（最后一行）点「上传目录」→ 本地选 Word + Excel 两个文件
await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]')
  const links = [...dialog.querySelectorAll('button, a, span')].filter(
    (el) => (el.textContent || '').trim() === '上传目录',
  )
  const last = links[links.length - 1]
  if (last) last.click()
})
await sleep(400)
const fileInput = await page.$('[role="dialog"] input[type="file"]')
await fileInput.uploadFile(path.join(TMP, '受试者随访计划.docx'), path.join(TMP, '中心实验室正常值范围.xlsx'))
await sleep(800)
await page.screenshot({ path: `${OUT}verify27-1-picked.png` })
console.log('1 picked badge:', await page.evaluate(() => document.body.textContent.includes('已选 2 个')))

// 3) 提交「上传」→ toast + 目录出现在列表
await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]')
  for (const btn of dialog.querySelectorAll('button')) {
    if ((btn.textContent || '').trim().includes('上传') && !(btn.textContent || '').includes('上传目录')) { btn.click(); return }
  }
})
await sleep(1000)
await page.screenshot({ path: `${OUT}verify27-2-created.png` })
console.log('2 created toast:', await page.evaluate(() => document.body.textContent.includes('目录创建成功')))

// 4) 打开新目录 → 钻取视图显示 Word/Excel 两个文件
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tr')) {
    if ((tr.textContent || '').includes('ON101CL103-随访管理文档')) { tr.click(); return }
  }
})
await sleep(900)
await page.screenshot({ path: `${OUT}verify27-3-inside.png` })
console.log('3 word inside:', await page.evaluate(() => document.body.textContent.includes('受试者随访计划.docx')))
console.log('3 excel inside:', await page.evaluate(() => document.body.textContent.includes('中心实验室正常值范围.xlsx')))

await browser.close()
