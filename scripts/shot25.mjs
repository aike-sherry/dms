// 验证：PM TRANSFER 文件夹编号可选 + 删除模式（勾选/取消/确认）
import puppeteer from 'puppeteer-core'
import { fileURLToPath } from 'node:url'

const BASE = process.argv[2] || 'http://localhost:5199'
const OUT = fileURLToPath(new URL('../../shots/', import.meta.url))
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
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
await page.goto(`${BASE}/?s=7#/transfer`, { waitUntil: 'networkidle0' })
await sleep(1500)

// 1) 新建文件夹 → Enter 保持默认名 → 点该行编号徽标 → 弹窗选 ON101CL01 → 确认更换
await clickBtn(page, '新建')
await sleep(600)
await page.keyboard.press('Enter')
await sleep(500)
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tr')) {
    if ((tr.textContent || '').includes('新建文件夹')) {
      for (const btn of tr.querySelectorAll('button')) {
        if ((btn.textContent || '').includes('ON101CL')) { btn.click(); return }
      }
    }
  }
})
await sleep(600)
await page.select('[role="dialog"] select', 'ON101CL01')
await sleep(200)
await page.screenshot({ path: `${OUT}verify25-1-picker.png` })
await clickBtn(page, '确认更换', '[role="dialog"]')
await sleep(900)
await page.screenshot({ path: `${OUT}verify25-2-changed.png` })
console.log('1 proj changed:', await page.evaluate(() => document.body.textContent.includes('编号已更新为 ON101CL01') || document.body.textContent.includes('项目编号已更新')))

// 2) 删除模式：勾选 2 行 → 截图 → 取消（数据保留）
await clickBtn(page, '删除')
await sleep(500)
const boxes = await page.$$('tbody input[type="checkbox"]')
if (boxes[0]) await boxes[0].click()
if (boxes[1]) await boxes[1].click()
await sleep(400)
await page.screenshot({ path: `${OUT}verify25-3-delmode.png` })
console.log('2 delete mode, checked 2')
await clickBtn(page, '取消')
await sleep(500)
const rowCountAfterCancel = await page.evaluate(() => document.querySelectorAll('tbody tr').length)
console.log('3 rows kept after cancel:', rowCountAfterCancel)

// 3) 再次进入删除模式 → 勾选 1 行 → 确认删除 → toast + 行消失
await clickBtn(page, '删除')
await sleep(500)
const boxes2 = await page.$$('tbody input[type="checkbox"]')
if (boxes2[0]) await boxes2[0].click()
await sleep(300)
await clickBtn(page, '确认删除')
await sleep(900)
await page.screenshot({ path: `${OUT}verify25-4-deleted.png` })
console.log('4 deleted:', await page.evaluate(() => document.body.textContent.includes('已删除 1 项')))

// 4) 执行端删除模式
await page.goto(`${BASE}/?s=8`, { waitUntil: 'networkidle0' })
await page.evaluate(() => sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'executor' })))
await page.goto(`${BASE}/?s=9#/transfer`, { waitUntil: 'networkidle0' })
await sleep(1500)
await clickBtn(page, '删除')
await sleep(500)
const exBoxes = await page.$$('tbody input[type="checkbox"]')
if (exBoxes[0]) await exBoxes[0].click()
await sleep(400)
await page.screenshot({ path: `${OUT}verify25-5-exdel.png` })
console.log('5 executor delete mode')

await browser.close()
