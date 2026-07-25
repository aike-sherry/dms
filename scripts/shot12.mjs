// 查看执行端 SUBMISSION 日期插件现状
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
await page.goto(`${BASE}/?s=1#/submission`, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 1500))

// 点「更新」进入编辑模式
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if ((btn.textContent || '').trim().includes('更新')) { btn.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 600))

// 点第一个「选择日期」打开日历
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('td button')) {
    if ((btn.textContent || '').includes('选择日期') || /\d{4}-\d{2}-\d{2}/.test(btn.textContent || '')) { btn.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 800))
await page.screenshot({ path: `${OUT}verify11-datepicker.png`, fullPage: true })
console.log('saved datepicker')
await browser.close()
