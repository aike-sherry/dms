import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5199'
const OUT = 'C:\\Users\\huawe\\Documents\\Kimi\\Workspaces\\ClinicalTrialsDocumentM\\shots'
const TMP = 'C:\\Users\\huawe\\Documents\\Kimi\\Workspaces\\ClinicalTrialsDocumentM\\tmp-upload'
const ICF = `${TMP}\\知情同意书V2_20260809.pdf`

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  defaultViewport: { width: 1600, height: 1000 },
})
const page = await browser.newPage()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const login = async (role, hash) => {
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate((r) => {
    sessionStorage.setItem('clinx-auth', JSON.stringify({ role: r }))
  }, role)
  await page.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle0' })
  await page.reload({ waitUntil: 'networkidle0' })
  await sleep(2500)
}

const clickBtn = (text, scope = 'document') =>
  page.evaluate(
    (t, s) => {
      const root = s === 'dialog' ? document.querySelector('[role="dialog"]') : document
      const btn = [...(root?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === t)
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return !!btn
    },
    text,
    scope,
  )

const openUploadAndPick = async () => {
  await clickBtn('上传')
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

/* 1. 执行端首次加载：清持久化 → 种子落库 */
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  sessionStorage.setItem('clinx-auth', JSON.stringify({ role: 'executor' }))
  localStorage.removeItem('clinx-data-v2')
})
await page.goto(`${BASE}/#/transfer`, { waitUntil: 'networkidle0' })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(2500)

/* 2. 注入 PM 已建文件夹：SITE TMF（瑞金/ON101CL01）词表文件夹「知情同意书」「研究方案」；
      STUDY TMF 分区/类型文件夹（f13 挂入 → 版本历史弹窗展示归档位置提示） */
const inj = await page.evaluate(() => {
  const data = JSON.parse(localStorage.getItem('clinx-data-v2'))
  const site = data.catalogs.find((c) => c.kind === 'site' && c.projectNo === 'ON101CL01' && c.center === '上海瑞金医院')
  const study = data.catalogs.find((c) => c.kind === 'study' && c.projectNo === 'ON101CL01')
  if (!site || !study) return { ok: false, site: !!site, study: !!study }
  const base = {
    projectNo: 'ON101CL01',
    center: '上海瑞金医院',
    uploader: '石磊',
    uploadDate: '2026-08-01',
    size: '0KB',
    status: 'archived',
  }
  data.files.push(
    { id: 'pmf1', name: '知情同意书', kind: 'folder', ...base, folderId: site.id },
    { id: 'pmf2', name: '研究方案', kind: 'folder', ...base, folderId: site.id },
    { id: 'pmz1', name: '04 受试者文件', kind: 'folder', ...base, folderId: study.id },
    { id: 'pmd1', name: '知情同意书', kind: 'folder', ...base, folderId: study.id, parentId: 'pmz1' },
  )
  const f13 = data.files.find((f) => f.id === 'f13')
  if (f13) f13.parentId = 'pmd1'
  localStorage.setItem('clinx-data-v2', JSON.stringify(data))
  return { ok: true, site: site.id, study: study.id }
})
console.log('inject:', JSON.stringify(inj))
await page.reload({ waitUntil: 'networkidle0' })
await sleep(2500)

/* 3. R6① PM 命名规则弹窗 */
await login('pm', '/transfer')
console.log('open 命名规则:', await clickBtn('命名规则'))
await sleep(800)
const tpl = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]')
  return {
    value: dlg?.querySelector('input')?.value,
    preview: dlg?.querySelector('.text-teal-600')?.textContent?.trim(),
    pills: [...(dlg?.querySelectorAll('button') ?? [])].filter((b) => ['项目编号', '文档类型', '版本', '日期', '研究中心'].includes(b.textContent.trim())).length,
  }
})
console.log('naming dialog:', JSON.stringify(tpl))
await page.screenshot({ path: `${OUT}\\60-pm-naming-rule.png` })
await page.keyboard.press('Escape')
await sleep(500)

/* 4. R6② 执行端上传 → 确认命名步骤（预选 + 预览） */
await login('executor', '/transfer')
let input = await openUploadAndPick()
await input.uploadFile(ICF)
await sleep(1000)
const confirm1 = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]')
  const sel = dlg?.querySelector('select')
  return {
    value: sel?.value,
    options: [...(sel?.options ?? [])].map((o) => o.value),
    preview: dlg?.querySelector('.text-teal-600')?.textContent?.trim(),
    confirmDisabled: [...(dlg?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === '确认上传')?.disabled,
  }
})
console.log('confirm step #1:', JSON.stringify(confirm1))
await page.screenshot({ path: `${OUT}\\61-cra-confirm-naming.png` })

/* R6③ 确认上传 → toast + 列表新名 */
await clickBtn('确认上传', 'dialog')
await sleep(1200)
await page.screenshot({ path: `${OUT}\\62-cra-named-toast.png` })
await sleep(2500)
const list1 = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tr')].map((r) => r.textContent)
  return { v4: rows.some((t) => t.includes('ON101CL01-知情同意书-V4.0（2026-08-09）')) }
})
console.log('after confirm #1:', JSON.stringify(list1))

/* 5. 再传同一文件 → 确认步骤预览应为 V5.0（版本链递增） */
input = await openUploadAndPick()
await input.uploadFile(ICF)
await sleep(1000)
const confirm2 = await page.evaluate(
  () => document.querySelector('[role="dialog"] .text-teal-600')?.textContent?.trim(),
)
console.log('confirm step #2 preview:', confirm2)
await clickBtn('确认上传', 'dialog')
await sleep(1500)

/* 6. 提交 V4.0 / V5.0 供 PM 审核 */
for (const m of ['知情同意书-V4.0', '知情同意书-V5.0']) {
  await page.evaluate((marker) => {
    const row = [...document.querySelectorAll('tr')].find((r) => r.textContent.includes(marker))
    const btn = [...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === '提交')
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }, m)
  await sleep(1200)
}

/* 7. PM 驳回 V4.0（制造版本链中的驳回行） */
await login('pm', '/review')
await page.evaluate(() => {
  const row = [...document.querySelectorAll('tr')].find((r) => r.textContent.includes('知情同意书-V4.0'))
  const btn = [...(row?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === '审核')
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(1500)
await page.type('textarea', '版本内容有误，请核对后重新上传')
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === '驳回').pop()
  btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(1500)

/* 8. R5① 执行端点 History 图标 → 版本历史弹窗（V3.0 归档 + V4.0 驳回 + V5.0 当前） */
await login('executor', '/transfer')
await page.evaluate(() => {
  const row = [...document.querySelectorAll('tr')].find((r) => r.textContent.includes('知情同意书-V5.0'))
  row?.querySelector('button[title^="查看版本历史"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(900)
const vd = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]')
  return {
    title: [...(dlg?.querySelectorAll('span') ?? [])].find((s) => s.textContent.includes('版本历史'))?.textContent,
    rows: [...(dlg?.querySelectorAll('tbody tr') ?? [])].map((r) => r.textContent.replace(/\s+/g, ' ')),
  }
})
console.log('version dialog (ex):', JSON.stringify(vd, null, 1))
await page.screenshot({ path: `${OUT}\\63-ex-version-dialog.png` })
await page.keyboard.press('Escape')
await sleep(500)

/* 9. R5② + R6④ PM REVIEW：新名列表 + 版本历史弹窗 */
await login('pm', '/review')
await page.screenshot({ path: `${OUT}\\64-pm-review-newname.png` })
await page.evaluate(() => {
  const row = [...document.querySelectorAll('tr')].find((r) => r.textContent.includes('知情同意书-V5.0'))
  row?.querySelector('button[title^="查看版本历史"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await sleep(900)
const vd2 = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]')
  return {
    title: [...(dlg?.querySelectorAll('span') ?? [])].find((s) => s.textContent.includes('版本历史'))?.textContent,
    rows: [...(dlg?.querySelectorAll('tbody tr') ?? [])].length,
  }
})
console.log('version dialog (pm):', JSON.stringify(vd2))
await page.screenshot({ path: `${OUT}\\65-pm-version-dialog.png` })

await browser.close()
console.log('done')
