import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5199'
const OUT = 'C:\\Users\\huawe\\Documents\\Kimi\\Workspaces\\ClinicalTrialsDocumentM\\shots'
const TMP = 'C:\\Users\\huawe\\Documents\\Kimi\\Workspaces\\ClinicalTrialsDocumentM\\tmp-upload'
const FILES = [`${TMP}\\知情同意书V2_20260301.pdf`, `${TMP}\\伦理批件-瑞金.pdf`, `${TMP}\\随便起名123.pdf`]

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  defaultViewport: { width: 1600, height: 1000 },
})
const page = await browser.newPage()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* 打开上传弹窗 → 选项目编号 → 上传 3 个测试文件 */
async function uploadViaDialog(projectNo) {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '上传')
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await sleep(800)
  // 弹窗内项目编号下拉（原生 select，React 受控：设值 + change 事件）
  await page.evaluate((p) => {
    const dialog = document.querySelector('[role="dialog"]')
    const sel = dialog?.querySelector('select')
    if (sel) {
      sel.value = p
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, projectNo)
  await sleep(300)
  const input = await page.$('[role="dialog"] input[type="file"]')
  await input.uploadFile(...FILES)
  await sleep(1500)
}

/* ===== ① 执行端上传：列表显示规范新名 + 合并 toast ===== */
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'executor' }))
  localStorage.removeItem('clinx-data-v2')
})
await page.goto(`${BASE}/#/transfer`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)
await uploadViaDialog('ON101CL01')
await page.screenshot({ path: `${OUT}\\48-ex-upload-autoname.png` })
await sleep(3000)

/* 提交已规范命名的「知情同意书」文件 */
await page.evaluate(() => {
  const row = [...document.querySelectorAll('tr')].find((r) => r.textContent.includes('知情同意书'))
  const btn = [...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === '提交')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(1200)

/* ===== ② PM 端 REVIEW 显示规范名 ===== */
await page.evaluate(() => {
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'pm' }))
})
await page.goto(`${BASE}/#/review`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)
await page.screenshot({ path: `${OUT}\\48-pm-review-names.png` })

/* ===== ③ PM 端 TRANSFER 上传同样自动命名 ===== */
await page.goto(`${BASE}/#/transfer`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(3000)
await uploadViaDialog('ON101CL103')
await page.screenshot({ path: `${OUT}\\48-pm-transfer-autoname.png` })

await browser.close()
console.log('done')
