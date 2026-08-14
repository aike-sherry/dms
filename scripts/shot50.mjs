import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5199'
const OUT = 'C:\\Users\\huawe\\Documents\\Kimi\\Workspaces\\ClinicalTrialsDocumentM\\shots'
const TMP = 'C:\\Users\\huawe\\Documents\\Kimi\\Workspaces\\ClinicalTrialsDocumentM\\tmp-upload'
const ICF = `${TMP}\\知情同意书V2_20260809.pdf`
const MEMO = `${TMP}\\备忘录V2.5_20260809.pdf`

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  defaultViewport: { width: 1600, height: 1000 },
})
const page = await browser.newPage()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* 执行端登录（张兰 / 上海瑞金医院），清持久化数据保证种子 f13（ICF V3.0）在场 */
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'executor' }))
  localStorage.removeItem('clinx-data-v2')
})
await page.goto(`${BASE}/#/transfer`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)

const openUpload = async () => {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '上传')
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(800)
  await page.evaluate(() => {
    const sel = document.querySelector('[role="dialog"]')?.querySelector('select')
    if (sel) {
      sel.value = 'ON101CL01'
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  await sleep(300)
  return page.$('[role="dialog"] input[type="file"]')
}

/* ① 第一次上传：ICF V2（历史最大 V3.0 → 应命名为 V4.0 并关联 f13）+ 备忘录 V2.5（无历史 → 原样保留） */
let input = await openUpload()
await input.uploadFile(ICF, MEMO)
await sleep(1200)
await page.screenshot({ path: `${OUT}\\50-ex-upload-toast.png` })
await sleep(2500)

/* 列表断言：V4.0 / 备忘录 V2.5 行存在，且出现「上一版本」悬浮图标 */
const info1 = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tr')].map((r) => r.textContent)
  const histTitles = [...document.querySelectorAll('[title^="上一版本"]')].map((el) => el.getAttribute('title'))
  return {
    v4: rows.some((t) => t.includes('知情同意书 V4.0')),
    memo: rows.some((t) => t.includes('备忘录 V2.5')),
    histTitles,
  }
})
console.log('after 1st upload:', JSON.stringify(info1, null, 1))
await page.screenshot({ path: `${OUT}\\51-ex-list-hist-icon.png` })

/* ② 第二次上传同一 ICF → 应递增为 V5.0 */
input = await openUpload()
await input.uploadFile(ICF)
await sleep(1200)
await page.screenshot({ path: `${OUT}\\52-ex-second-upload-toast.png` })
const info2 = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tr')].map((r) => r.textContent)
  return { v5: rows.some((t) => t.includes('知情同意书 V5.0')) }
})
console.log('after 2nd upload:', JSON.stringify(info2))
await sleep(2500)

/* 提交 V5.0 供 PM 审核 */
await page.evaluate(() => {
  const row = [...document.querySelectorAll('tr')].find((r) => r.textContent.includes('知情同意书 V5.0'))
  const btn = [...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === '提交')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(1500)

/* ③ PM 端 REVIEW：V5.0 行带版本历史图标 */
await page.evaluate(() => {
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' }))
})
await page.goto(`${BASE}/#/review`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)
const info3 = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tr')].map((r) => r.textContent)
  const histTitles = [...document.querySelectorAll('[title^="上一版本"]')].map((el) => el.getAttribute('title'))
  return { v5: rows.some((t) => t.includes('知情同意书 V5.0')), histTitles }
})
console.log('pm review:', JSON.stringify(info3, null, 1))
await page.screenshot({ path: `${OUT}\\53-pm-review-hist.png` })

await browser.close()
console.log('done')
