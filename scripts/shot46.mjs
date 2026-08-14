import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5199'
const OUT = 'C:\\Users\\huawe\\Documents\\Kimi\\Workspaces\\ClinicalTrialsDocumentM\\shots'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  defaultViewport: { width: 1600, height: 1000 },
})
const page = await browser.newPage()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const clickByText = (text, scope = 'button') =>
  page.evaluate(
    ({ text, scope }) => {
      const el = [...document.querySelectorAll(scope)].find((b) => b.textContent.trim() === text)
      el?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    },
    { text, scope },
  )

await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' }))
  /* 清空旧持久化数据，保证从 DEMO 种子全新开始 */
  localStorage.removeItem('clinx-data-v2')
})
await page.goto(`${BASE}/#/transfer`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)

// 制造待分拣文件：归档无法识别命名的「Study–TMF」(pdf 行) → 99 待分拣
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tr')].filter((r) => r.textContent.includes('Study–TMF'))
  const row = rows.find((r) => r.textContent.includes('智能命名'))
  const btn = [...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === '归档')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(4500)
// ① 待分拣按钮 + 琥珀色徽标
await page.screenshot({ path: `${OUT}\\46-transfer-unsorted-badge.png` })

// 打开待分拣弹窗 → 列表
await clickByText('待分拣')
await sleep(1000)
await page.screenshot({ path: `${OUT}\\46-unsorted-dialog.png` })

// ② 归位 → toast + 列表刷新（空态 + 徽标消失）
await clickByText('归位')
await sleep(1200)
await page.screenshot({ path: `${OUT}\\46-unsorted-rehomed.png` })
await sleep(3500)
await page.keyboard.press('Escape')
await sleep(500)

// ③ STUDY TMF (cat-st0 = ON101CL103) 钻取确认归位落位：01 试验管理文件 下直接可见
await page.goto(`${BASE}/#/study?drill=cat-st0`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)
await clickByText('01 试验管理文件')
await sleep(800)
await page.screenshot({ path: `${OUT}\\46-study-rehomed-zone01.png` })

// ④ REVIEW 审核通过 pending 文件（伦理递交信 → 伦理委员会批件 → 02 伦理与监管文件）
await page.goto(`${BASE}/#/review`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)
await page.evaluate(() => {
  const row = [...document.querySelectorAll('tr')].find((r) => r.textContent.includes('伦理递交信–上海瑞金医院'))
  const btn = [...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === '归档')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(1200)
await page.screenshot({ path: `${OUT}\\46-review-approve-toast.png` })
await sleep(3500)

// STUDY TMF (cat-st1 = ON101CLCT06 STUDY TMF / ON101CL01) 确认审核落位
await page.goto(`${BASE}/#/study?drill=cat-st1`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)
await clickByText('02 伦理与监管文件')
await sleep(800)
await page.screenshot({ path: `${OUT}\\46-study-review-zone02.png` })
await clickByText('伦理委员会批件')
await sleep(800)
await page.screenshot({ path: `${OUT}\\46-study-review-doctype.png` })

await browser.close()
console.log('done')
