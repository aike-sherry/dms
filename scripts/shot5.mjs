// 验证：归档 → STUDY/SITE TMF 目录与统计实时联动（应用内导航，不刷新页面）
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

async function clickNav(page, text) {
  await page.evaluate((t) => {
    for (const el of document.querySelectorAll('nav button, nav a, aside button, aside a')) {
      if ((el.textContent || '').trim().includes(t)) { el.click(); return }
    }
  }, text)
  await new Promise((r) => setTimeout(r, 800))
}

async function clickRow(page, text) {
  await page.evaluate((t) => {
    for (const tr of document.querySelectorAll('tr')) {
      if ((tr.textContent || '').includes(t)) { tr.click(); return }
    }
  }, text)
  await new Promise((r) => setTimeout(r, 700))
}

// ===== 场景 1：PM Transfer 归档 → STUDY TMF =====
let page = await newPage('pm', '/transfer')
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tr')) {
    const t = tr.textContent || ''
    if (t.includes('Study–TMF') && t.includes('归档')) {
      const btn = [...tr.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '归档')
      if (btn) { btn.click(); return }
    }
  }
})
await new Promise((r) => setTimeout(r, 800))
await clickNav(page, 'STUDY TMF')
await page.screenshot({ path: `${OUT}verify6-study-tmf.png` })
console.log('saved study-tmf')
await clickRow(page, 'ON101CL103 STUDY TMF')
await page.screenshot({ path: `${OUT}verify6-study-tmf-drill.png` })
console.log('saved study-tmf-drill')
await page.close()

// ===== 场景 2：PM REVIEW 归档文件夹 → SITE TMF（级联子文件） =====
page = await newPage('pm', '/review')
await page.evaluate(() => {
  for (const tr of document.querySelectorAll('tr')) {
    if ((tr.textContent || '').includes('安全性报告')) {
      const link = [...tr.querySelectorAll('a,button,span')].find((b) => (b.textContent || '').trim() === '归档')
      if (link) { link.click(); return }
    }
  }
})
await new Promise((r) => setTimeout(r, 800))
await clickNav(page, 'SITE TMF')
await page.screenshot({ path: `${OUT}verify6-site-tmf.png` })
console.log('saved site-tmf')
await clickRow(page, '瑞金医院')
await page.screenshot({ path: `${OUT}verify6-site-tmf-drill.png` })
console.log('saved site-tmf-drill')

// 打开归档文件夹看级联子文件
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('td button')) {
    if ((btn.textContent || '').includes('安全性报告')) { btn.click(); return }
  }
})
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: `${OUT}verify6-site-tmf-subfolder.png` })
console.log('saved site-tmf-subfolder')
await page.close()

await browser.close()
