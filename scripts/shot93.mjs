// R39 二阶段A 验证：① admin AUDIT 命名审计页 + PM 文件属性命名历史/改名审计
//                    ② CRA 批量上传「应用到全部」+ 批量内重名避让 + 未绑定行可编辑
// DEMO_MODE=false 空白环境；截图 262 起，存工作区根 shots/
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:5199';
const SHOTS = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/shots/';
const RJQM = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/RJQM-文件管理体系.xlsx';
const FILES = ['batch-a.txt', 'batch-b.txt', 'batch-c.txt'].map(
  (n) => `C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/tmp-upload/${n}`,
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const assert = (cond, name) => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ FAIL: ${name}`); }
};
const now = new Date();
const COMPACT = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
const R2 = `ON101-会议纪要-${COMPACT}-V2.0`; // 批量套用后的期望名
const CUSTOM = `ON101-会议纪要-启动会${COMPACT}`; // 行 3 手动覆盖名

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  defaultViewport: { width: 1517, height: 800 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

const shot = async (num, name) => {
  await page.screenshot({ path: `${SHOTS}${num}-${name}.png` });
  console.log(`  📸 ${num}-${name}.png`);
};
async function login(u, p, fresh = false) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate((fresh) => { sessionStorage.clear(); if (fresh) localStorage.clear(); }, fresh);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  await sleep(400);
  await page.evaluate(({ u, p }) => {
    const inputs = [...document.querySelectorAll('input')];
    const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(inputs[0], u); set(inputs[1], p);
    [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s/g, '') === '登录')?.click();
  }, { u, p });
  await page.waitForFunction(() => !!sessionStorage.getItem('clinx-auth'), { timeout: 8000 });
  await sleep(500);
}
async function navTo(name) {
  await page.evaluate((name) => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim().toUpperCase() === name.toUpperCase())?.click();
  }, name);
  await sleep(700);
}
async function clickText(text, scope = 'body') {
  return page.evaluate(({ text, scope }) => {
    const root = scope === 'body' ? document.body : document.querySelector(scope);
    if (!root) return false;
    const els = [...root.querySelectorAll('button, a, [role="button"], span, div, td, th, label')];
    let el = els.find((e) => e.children.length === 0 && e.textContent.trim() === text);
    if (!el) el = els.find((e) => (e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') && e.textContent.trim() === text);
    if (el) { el.click(); return true; }
    return false;
  }, { text, scope });
}
async function setInput(ph, value) {
  return page.evaluate(({ ph, value }) => {
    const el = [...document.querySelectorAll('[role="dialog"] input')].find((i) => i.placeholder === ph);
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, { ph, value });
}
async function setSelectWithOption(optText, value, scopeSel = '[role="dialog"]') {
  return page.evaluate(({ optText, value, scopeSel }) => {
    const root = document.querySelector(scopeSel);
    if (!root) return false;
    const sel = [...root.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.trim() === optText || o.value === optText));
    if (!sel) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { optText, value, scopeSel });
}
const readData = () => page.evaluate(() => JSON.parse(localStorage.getItem('clinx-data-v2') || '{}'));
const bodyHas = (t) => page.evaluate((t) => document.body.innerText.includes(t), t);
async function addCenterUI(proj, name, cra) {
  assert(await clickText('新增中心'), `打开新增中心弹窗（${name}）`);
  await sleep(500);
  assert(await setInput('请输入项目编号', proj), `填写项目编号 ${proj}`);
  assert(await setInput('请输入研究中心名称', name), `填写中心名称 ${name}`);
  assert(await setSelectWithOption(cra, cra), `选择 CRA ${cra}`);
  assert(await clickText('确认新增', '[role="dialog"]'), `确认新增 ${name}`);
  await sleep(500);
}
const drillRow = (name) => page.evaluate((name) => {
  const rows = [...document.querySelectorAll('tbody tr')];
  const r = rows.find((x) => x.querySelector('td')?.textContent.trim().startsWith(name));
  return r ? r.textContent : null;
}, name);
async function clickRowLink(rowName, linkText) {
  return page.evaluate(({ rowName, linkText }) => {
    const rows = [...document.querySelectorAll('tbody tr')];
    const r = rows.find((x) => x.querySelector('td')?.textContent.trim().startsWith(rowName));
    if (!r) return false;
    const el = [...r.querySelectorAll('button, span, a')].find((e) => e.textContent.trim() === linkText);
    if (el) { el.click(); return true; }
    return false;
  }, { rowName, linkText });
}
async function drillCatalog(catName) {
  await page.evaluate((catName) => {
    [...document.querySelectorAll('tbody tr')].find((x) => x.textContent.includes(catName))?.click();
  }, catName);
  await sleep(700);
}
/* CRA 上传对话框：打开 → 选项目/中心 → 多文件上传 */
async function craOpenUpload() {
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '上传');
    if (!b) return false;
    b.click();
    return true;
  });
  assert(opened, 'CRA 工具栏点上传');
  await sleep(600);
  assert(await setSelectWithOption('ON101', 'ON101'), '对话框选项目 ON101');
  await sleep(400);
  assert(await setSelectWithOption('江苏大学附属医院', '江苏大学附属医院'), '对话框选中心');
  await sleep(400);
}
/* CRA 行快照数组（按 relName 定位行） */
const craRows = () => page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return [];
  return [...dlg.querySelectorAll('.border-b')].map((row) => {
    const sels = [...row.querySelectorAll('select')];
    const wizType = sels.find((s) => [...s.options].some((o) => o.value === '会议纪要'));
    const versionSel = sels.find((s) => [...s.options].some((o) => o.value === '2.0' && o.textContent.includes('V')));
    const statusSel = sels.find((s) => [...s.options].some((o) => o.value === '作废'));
    const inputs = [...row.querySelectorAll('input')];
    return {
      rel: row.querySelector('.w-44')?.textContent.trim() ?? '',
      targetVal: sels[0]?.value ?? '',
      hasWiz: !!wizType,
      badge: row.querySelector('span[title]')?.textContent.trim() ?? '',
      version: versionSel?.value ?? '',
      status: statusSel?.value ?? '',
      preview: inputs[inputs.length - 1]?.value ?? '',
      inputCount: inputs.length,
      text: row.textContent,
    };
  });
});
/* 按行内原文件名设置该行的某个 select（依 option 文本/值定位） */
async function rowSetSelect(relName, optText, value) {
  return page.evaluate(({ relName, optText, value }) => {
    const dlg = document.querySelector('[role="dialog"]');
    const row = [...dlg.querySelectorAll('.border-b')].find((r) => r.textContent.includes(relName));
    if (!row) return false;
    const sel = [...row.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.trim() === optText || o.value === optText));
    if (!sel) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { relName, optText, value });
}
async function rowSetPreview(relName, value) {
  return page.evaluate(({ relName, value }) => {
    const dlg = document.querySelector('[role="dialog"]');
    const row = [...dlg.querySelectorAll('.border-b')].find((r) => r.textContent.includes(relName));
    const inputs = [...(row?.querySelectorAll('input') ?? [])];
    const input = inputs[inputs.length - 1];
    if (!input) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, { relName, value });
}
/* 批量操作条赋值（操作条 = 直接含「应用到全部」span 的 div；与行内同label下拉区分开） */
async function bulkSet(optText, value) {
  return page.evaluate(({ optText, value }) => {
    const dlg = document.querySelector('[role="dialog"]');
    const bar = [...dlg.querySelectorAll('div')].find((d) =>
      [...d.children].some((c) => c.tagName === 'SPAN' && c.textContent.includes('应用到全部')),
    );
    if (!bar) return false;
    const sel = [...bar.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.trim() === optText || o.value === optText));
    if (!sel) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { optText, value });
}

/* 名称列精确匹配行（避免 R2 是 R2（2）的子串误匹配），点击行内指定文本按钮 */
async function clickRowByExactName(name, linkText) {
  return page.evaluate(({ name, linkText }) => {
    const r = [...document.querySelectorAll('tbody tr')].find(
      (x) => x.querySelector('td')?.textContent.trim() === name,
    );
    if (!r) return false;
    const el = [...r.querySelectorAll('button, span, a')].find((e) => e.textContent.trim() === linkText);
    if (el) { el.click(); return true; }
    return false;
  }, { name, linkText });
}

/* AUDIT 页筛选器在页面 toolbar（非弹窗），scope=main 避开 Header 全局项目选择器 */
async function setAuditFilter(optText, value) {
  return page.evaluate(({ optText, value }) => {
    const root = document.querySelector('main');
    if (!root) return false;
    const sel = [...root.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.trim() === optText || o.value === optText));
    if (!sel) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { optText, value });
}

// ═══════════ A. PM 建数据 + 绑骨架 ═══════════
console.log('▶ A. PM 造数据 + 绑定');
await login('shilei', '123456', true);
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('clinx-data-v2') || '{}');
  d.catalogs = d.catalogs ?? [];
  const t = new Date();
  const ds = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  d.catalogs.push({ id: 'cat-study-on101', kind: 'study', name: 'ON101 研究主文档', projectNo: 'ON101', creator: '石磊', createDate: ds, updateDate: ds, size: '0KB', status: '未完成' });
  localStorage.setItem('clinx-data-v2', JSON.stringify(d));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(600);
await navTo('HOME');
await addCenterUI('ON101', '江苏大学附属医院', '张兰');
await navTo('SITE TMF');
assert(await clickText('创建目录'), '打开 SITE 目录创建弹窗');
await sleep(600);
assert(await setSelectWithOption('ON101', 'ON101'), '选择项目 ON101');
await sleep(400);
assert(await clickText('上传目录', '[role="dialog"]'), '点上传目录');
await sleep(300);
{
  const fi = await page.$('[role="dialog"] input[type="file"]');
  await fi.uploadFile(RJQM);
  await sleep(1200);
  assert(await bodyHas('一级 13 · 二级 20'), 'RJQM 解析计数');
  assert(await clickText('确认创建'), '确认创建');
  await sleep(800);
}
await page.keyboard.press('Escape');
await sleep(400);
await drillCatalog('ON101-TMF-江苏大学附属医院');
assert(await clickRowLink('课题管理', '绑定骨架'), '课题管理 绑骨架');
await sleep(600);
assert(await setSelectWithOption('会议纪要命名', 'nt3'), '选 nt3');
assert(await clickText('保存', '[role="dialog"]'), '保存绑定');
await sleep(600);
assert((await drillRow('课题管理'))?.includes('骨架·会议纪要命名'), '绑定徽标在');
await shot(262, 'r39b-pm-bind');

// ═══════════ B. CRA 批量上传 + 应用到全部 ═══════════
console.log('▶ B. CRA 批量命名');
await login('zhanglan', '123456');
await navTo('TRANSFER');
await craOpenUpload();
{
  const fis = await page.$$('[role="dialog"] input[type="file"]');
  await fis[0].uploadFile(...FILES);
  await sleep(900);
  let rows = await craRows();
  assert(rows.length === 3, `批量 3 行（实际 ${rows.length}）`);
  for (const n of ['batch-a.txt', 'batch-b.txt', 'batch-c.txt'])
    assert(await rowSetSelect(n, '课题管理', '课题管理'), `${n} 目标选 课题管理`);
  await sleep(800);
  rows = await craRows();
  assert(rows.every((r) => r.hasWiz), '3 行均展开向导');
  /* 行 3 手动微调（类型手选 + 状态作废，置 touched），验证应用全部跳过该行 */
  assert(await rowSetSelect('batch-c.txt', '会议纪要｜会议纪要/沟通记录', '会议纪要'), '行3 手选类型 会议纪要');
  await sleep(200);
  assert(await rowSetSelect('batch-c.txt', '作废', '作废'), '行3 手改状态=作废');
  await sleep(300);
  /* 应用到全部：类型 会议纪要 / 版本 V2.0 / 状态 终版 */
  assert(await bulkSet('会议纪要｜会议纪要/沟通记录', '会议纪要'), '操作条选类型');
  assert(await bulkSet('V2.0', '2.0'), '操作条选版本 V2.0');
  assert(await bulkSet('终版', '终版'), '操作条选状态 终版');
  assert(await clickText('套用', '[role="dialog"]'), '点套用');
  await sleep(600);
  rows = await craRows();
  const [ra, rb, rc] = ['batch-a.txt', 'batch-b.txt', 'batch-c.txt'].map((n) => rows.find((r) => r.rel === n));
  assert(ra?.preview === R2, `行1 预览=${R2}（实际 ${ra?.preview}）`);
  assert(rb?.preview === R2, `行2 预览=${R2}（实际 ${rb?.preview}）`);
  assert(rc?.preview === `ON101-会议纪要-${COMPACT}-V1.0` && rc?.status === '作废', `行3 微调行未被套用（实际 ${rc?.preview}/${rc?.status}）`);
  assert(ra?.version === '2.0' && ra?.status === '终版', '行1 版本/状态已套用');
  /* 行 3 手动覆盖预览名 */
  assert(await rowSetPreview('batch-c.txt', CUSTOM), '行3 手动覆盖预览名');
  await sleep(400);
  rows = await craRows();
  assert(rows.find((r) => r.rel === 'batch-c.txt')?.preview === CUSTOM, '行3 覆盖值保留');
}
await shot(263, 'r39b-cra-bulk-bar');
assert(await clickText('确认上传', '[role="dialog"]'), '确认上传 3 文件');
await sleep(1000);
{
  const d = await readData();
  const fs = d.files?.filter((x) => x.namingTemplateId === 'nt3' && x.kind === 'pdf') ?? [];
  assert(fs.length === 3, `落库 3 文件（实际 ${fs.length}）`);
  const names = fs.map((f) => f.displayFilename).sort();
  assert(names.join('|') === [CUSTOM, R2, `${R2}（2）`].sort().join('|'), `批量内重名自动避让（实际 ${names.join('|')}）`);
  const fa = fs.find((f) => f.originalFilename === 'batch-a.txt');
  const fc = fs.find((f) => f.originalFilename === 'batch-c.txt');
  assert(fa?.versionNo === '2.0' && fa?.docStatus === '终版' && fa?.docType === '会议纪要', '行1 业务字段=套用值');
  assert(fc?.displayFilename === CUSTOM && fc?.versionNo === '1.0' && fc?.docStatus === '作废', '行3 覆盖名+手改状态落库');
  assert(fs.every((f) => f.originalFilename && f.displayFilename && f.namingTemplateId && f.versionNo && f.docStatus && f.docType), '3 文件六字段齐');
  const logs = d.namingLogs ?? [];
  assert(logs.length === 3, `namingLogs 3 条（实际 ${logs.length}）`);
  assert(logs.every((l) => l.projectNo === 'ON101' && l.role === 'executor' && l.originalFilename), '日志含项目/角色/原文件名');
  const dup = logs.find((l) => l.action === '重名追加');
  assert(!!dup && dup.oldValue === R2 && dup.newValue === `${R2}（2）`, `重名追加日志（${dup?.oldValue}→${dup?.newValue}）`);
  assert(logs.filter((l) => l.action === '创建命名').length === 2, '创建命名 2 条');
}
await shot(264, 'r39b-cra-batch-uploaded');

// ═══════════ C. admin AUDIT 页 ═══════════
console.log('▶ C. admin AUDIT');
await login('admin', '123456');
await navTo('AUDIT');
{
  assert(await bodyHas('命名审计日志'), 'AUDIT 页标题');
  const cnt = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
  assert(cnt === 3, `列表 3 行（实际 ${cnt}）`);
  assert(await bodyHas('重名追加') && await bodyHas('创建命名'), '动作徽标齐全');
  assert(await bodyHas('batch-a.txt'), '原文件名列');
  assert(await bodyHas(R2), '新显示名列');
  /* 项目筛选 */
  assert(await setAuditFilter('ON101', 'ON101'), '项目筛选 ON101');
  await sleep(400);
  assert((await page.evaluate(() => document.querySelectorAll('tbody tr').length)) === 3, 'ON101 筛选后仍 3 行');
}
await shot(265, 'r39b-admin-audit');

// ═══════════ D. CRA 提交 → PM 归档 → 属性/改名 ═══════════
console.log('▶ D. PM 属性 + 改名审计');
await login('zhanglan', '123456');
await navTo('TRANSFER');
for (const n of [R2, `${R2}（2）`, CUSTOM]) {
  assert(await clickRowByExactName(n, '提交'), `CRA 提交 ${n}`);
  await sleep(400);
}
await login('shilei', '123456');
await navTo('REVIEW');
for (const n of [R2, `${R2}（2）`, CUSTOM]) {
  assert(await clickRowByExactName(n, '归档'), `PM 归档 ${n}`);
  await sleep(500);
}
await navTo('SITE TMF');
await drillCatalog('ON101-TMF-江苏大学附属医院');
await page.evaluate(() => {
  const r = [...document.querySelectorAll('tbody tr')].find((x) => x.querySelector('td')?.textContent.trim().startsWith('课题管理'));
  [...r.querySelectorAll('button')].find((b) => b.textContent.trim() === '课题管理')?.click();
});
await sleep(700);
{
  const rowA = await page.evaluate((n) => {
    const r = [...document.querySelectorAll('tbody tr')].find((x) => x.querySelector('td')?.textContent.trim() === n);
    return r ? r.textContent : null;
  }, R2);
  assert(!!rowA, '归档后钻取内可见文件');
  assert(await clickRowByExactName(R2, '属性'), '打开文件属性');
  await sleep(600);
  assert(await bodyHas('原始文件名（系统留档，不可修改）') && await bodyHas('batch-a.txt'), '属性弹窗原文件名只读');
  assert(await bodyHas('命名历史（1 条）'), '命名历史 1 条');
  assert(await bodyHas('创建命名'), '时间线含创建命名');
}
await shot(267, 'r39b-pm-attr-timeline');
/* 改名 → 审计追加 */
const RENAMED = `${R2}-修订`;
{
  const ok = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return false;
    const input = [...dlg.querySelectorAll('input')].find((i) => i.value && !i.placeholder);
    if (!input) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  });
  assert(ok, '定位展示名输入框');
  await page.evaluate((v) => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return;
    const input = [...dlg.querySelectorAll('input')].find((i) => !i.placeholder);
    if (!input) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, RENAMED);
  await sleep(300);
  assert(await clickText('保存', '[role="dialog"]'), '保存展示名');
  await sleep(600);
  const d = await readData();
  const f = d.files?.find((x) => x.originalFilename === 'batch-a.txt');
  assert(f?.displayFilename === RENAMED && f?.name === R2, `displayFilename 改、name 不变（${f?.displayFilename}）`);
  const logs = d.namingLogs?.filter((l) => l.fileId === f?.id) ?? [];
  assert(logs.length === 2 && logs[0].action === '修改文件名' && logs[0].operator === '石磊' && logs[0].role === 'pm' && logs[0].oldValue === R2 && logs[0].newValue === RENAMED, '修改文件名审计追加');
}
/* 重开属性看时间线 2 条 */
assert(await clickRowByExactName(RENAMED, '属性'), '重开属性弹窗');
await sleep(600);
assert(await bodyHas('命名历史（2 条）'), '时间线 2 条');
assert(await bodyHas('修改文件名'), '时间线含修改文件名');
await shot(268, 'r39b-pm-attr-renamed');
await page.keyboard.press('Escape');
await sleep(400);

// ═══════════ E. admin AUDIT 改名记录 + 筛选 ═══════════
console.log('▶ E. AUDIT 改名记录');
await login('admin', '123456');
await navTo('AUDIT');
{
  const cnt = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
  assert(cnt === 4, `列表 4 行（实际 ${cnt}）`);
  assert(await bodyHas('修改文件名') && await bodyHas(RENAMED), '改名记录可见');
  assert(await setAuditFilter('石磊', '石磊'), '操作人筛选 石磊');
  await sleep(400);
  const cnt2 = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
  assert(cnt2 === 1, `石磊筛选后 1 行（实际 ${cnt2}）`);
}
await shot(269, 'r39b-admin-audit-renamed');

// ═══════════ F. 未绑定目录批量：行名可编辑 ═══════════
console.log('▶ F. 未绑定批量手动命名');
await login('zhanglan', '123456');
await navTo('TRANSFER');
await craOpenUpload();
{
  const fis = await page.$$('[role="dialog"] input[type="file"]');
  await fis[0].uploadFile(FILES[0], FILES[1]);
  await sleep(900);
  for (const n of ['batch-a.txt', 'batch-b.txt'])
    assert(await rowSetSelect(n, '课题团队', '课题团队'), `${n} 目标选 课题团队`);
  await sleep(800);
  const rows = await craRows();
  assert(rows.length === 2 && rows.every((r) => !r.hasWiz && r.badge === ''), '未绑定行无向导无徽标');
  assert(rows.every((r) => r.inputCount === 1 && r.preview !== ''), '批量未绑定行名称可编辑且带入预览');
  const MANUAL = 'ON101-课题团队-沟通记录-手动命名';
  assert(await rowSetPreview('batch-a.txt', MANUAL), '手改未绑定行名称');
  await sleep(300);
  assert(!(await bodyHas('应用到全部')), '无绑定行时操作条不显示');
}
await shot(270, 'r39b-cra-unbound-batch');
assert(await clickText('确认上传', '[role="dialog"]'), '确认上传未绑定批量');
await sleep(900);
{
  const d = await readData();
  const f = d.files?.find((x) => x.name === 'ON101-课题团队-沟通记录-手动命名');
  assert(!!f && !f.namingTemplateId, '手动命名落库且无骨架字段');
  assert((d.namingLogs?.length ?? 0) === 4, `未绑定上传不写审计（仍 4 条，实际 ${d.namingLogs?.length}）`);
}

await browser.close();
console.log(`\n═══ R39 二阶段A 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
