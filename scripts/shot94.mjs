// R39 二阶段B 验证：① 标准目录树模板库（admin 维护 + PM 引用建目录 STUDY/SITE 双分支）
//                    ② AI 语义预填开关（开启预选+徽标 / 关闭不预选，均不落名）
// DEMO_MODE=false 空白环境；截图 271 起，存工作区根 shots/
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:5199';
const SHOTS = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/shots/';
const RJQM = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/RJQM-文件管理体系.xlsx';
const SAE_FILE = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/tmp-upload/ON101-SAE-20261002.txt';
const FREE_FILE = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/tmp-upload/临时记录-xyz.txt';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const assert = (cond, name) => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ FAIL: ${name}`); }
};
const now = new Date();
const COMPACT = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
const SAE_NAME = `ON101-江苏大学附属医院-SAE报告-${COMPACT}`;
const FREE_NAME = `ON101-江苏大学附属医院-SAE随访-${COMPACT}`;

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  defaultViewport: { width: 1517, height: 800 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
page.on('dialog', (d) => void d.accept()); // window.confirm（删除模板）自动确认

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
async function drillCatalog(catName) {
  await page.evaluate((catName) => {
    [...document.querySelectorAll('tbody tr')].find((x) => x.textContent.includes(catName))?.click();
  }, catName);
  await sleep(700);
}
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
const drillRow = (name) => page.evaluate((name) => {
  const rows = [...document.querySelectorAll('tbody tr')];
  const r = rows.find((x) => x.querySelector('td')?.textContent.trim().startsWith(name));
  return r ? r.textContent : null;
}, name);
/* AI 开关（radix Switch：main 内 button[role=switch]） */
const aiSwitch = () => page.evaluate(() => {
  const sw = document.querySelector('main button[role="switch"]');
  return sw ? sw.getAttribute('data-state') : null;
});
const toggleAi = () => page.evaluate(() => {
  const sw = document.querySelector('main button[role="switch"]');
  if (!sw) return false;
  sw.click();
  return true;
});
/* CRA 行快照（SAE 骨架 nt2 版：类型下拉选项值 SAE报告/SAE随访） */
const craRow = (rel) => page.evaluate((rel) => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return null;
  const row = [...dlg.querySelectorAll('.border-b')].find((r) => r.textContent.includes(rel));
  if (!row) return null;
  const sels = [...row.querySelectorAll('select')];
  const typeSel = sels.find((s) => [...s.options].some((o) => o.value === 'SAE报告'));
  return {
    hasWiz: !!typeSel,
    docType: typeSel?.value ?? null,
    aiBadge: row.textContent.includes('AI 预填'),
    preview: (() => { const is = [...row.querySelectorAll('input')]; return is[is.length - 1]?.value ?? ''; })(),
  };
}, rel);
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

// ═══════════ A. admin 模板库 + AI 开关默认关 ═══════════
console.log('▶ A. admin 模板库');
await login('admin', '123456', true);
await navTo('NAMING');
{
  const d = await readData();
  assert(d.treeTemplates?.length === 1 && d.treeTemplates[0].id === 'tt1', '种子模板落库（tt1）');
  assert(d.treeTemplates[0].tree.length === 13, `种子 13 个一级目录（实际 ${d.treeTemplates[0].tree.length}）`);
  assert(d.aiPrefill === false, 'AI 预填默认关');
}
assert(await bodyHas('RJQM 标准文件管理体系'), '列表含种子模板');
assert(await bodyHas('一级 13 · 二级 20'), '列表结构计数 13/20');
assert((await aiSwitch()) === 'unchecked', '开关 UI 为关');
await shot(271, 'r39c-admin-templates');
/* 预览树 */
assert(await clickText('预览树'), '打开模板预览树');
await sleep(600);
assert(await bodyHas('模板预览 · RJQM 标准文件管理体系'), '预览弹窗标题');
assert(await bodyHas('课题管理') && await bodyHas('团队联系人') && await bodyHas('研究总结报告'), '预览树含一/二级节点');
await shot(272, 'r39c-template-tree-preview');
await page.keyboard.press('Escape');
await sleep(400);
/* 上传 RJQM Excel 新增模板 */
assert(await clickText('新增模板'), '打开新增模板弹窗');
await sleep(500);
{
  const fi = await page.$('[role="dialog"] input[type="file"]');
  assert(!!fi, '新增弹窗有上传入口');
  await fi.uploadFile(RJQM);
  await sleep(1200);
  assert(await bodyHas('一级 13 · 二级 20'), '新增弹窗解析计数');
  assert(await clickText('保存', '[role="dialog"]'), '保存新模板');
  await sleep(700);
  const d = await readData();
  assert(d.treeTemplates?.length === 2, `模板库 2 条（实际 ${d.treeTemplates?.length}）`);
  assert(d.treeTemplates.some((t) => t.name === 'RJQM-文件管理体系' && t.tree.length === 13), '新模板落库（文件名带入+13 一级）');
}
await shot(273, 'r39c-template-added');
/* 删除新增模板（保留种子；confirm 自动接受） */
{
  const clicked = await page.evaluate(() => {
    const tr = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('RJQM-文件管理体系'));
    const btn = tr?.querySelector('button[title^="删除模板"]');
    if (!btn) return false;
    btn.click();
    return true;
  });
  assert(clicked, '点删除新模板');
  await sleep(600);
  const d = await readData();
  assert(d.treeTemplates?.length === 1 && d.treeTemplates[0].id === 'tt1', '删除后仅剩种子模板');
}

// ═══════════ B. PM 引用标准模板建目录（STUDY + SITE） ═══════════
console.log('▶ B. PM 引用模板建目录');
await login('shilei', '123456');
/* 注入 ON101 STUDY 目录（CRA 上传弹窗项目选项来源） */
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
/* STUDY 分支：引用标准模板建 ON102 目录 */
await navTo('STUDY TMF');
assert(await clickText('创建目录'), '打开 STUDY 目录创建弹窗');
await sleep(600);
assert(await setInput('请输入项目编号', 'ON102'), 'STUDY 行填项目 ON102');
assert(await setSelectWithOption('RJQM 标准文件管理体系', 'tt1'), 'STUDY 行引用种子模板');
await sleep(600);
assert(await bodyHas('标准模板：RJQM 标准文件管理体系'), 'STUDY 行显示模板芯片');
assert(await clickText('预览', '[role="dialog"]'), 'STUDY 行展开预览');
await sleep(600);
assert(await bodyHas('将创建 一级 13 个 · 二级 20 个'), 'STUDY 预览计数');
await shot(274, 'r39c-pm-study-template');
assert(await clickText('确认创建'), 'STUDY 确认创建');
await sleep(900);
{
  const d = await readData();
  const cat = d.catalogs?.find((c) => c.kind === 'study' && c.projectNo === 'ON102');
  assert(!!cat && cat.name === 'ON102 STUDY TMF', 'STUDY 目录落库（ON102 STUDY TMF）');
  const folders = d.files?.filter((f) => f.kind === 'folder' && f.folderId === cat?.id) ?? [];
  assert(folders.length === 33, `STUDY 33 个文件夹落库（实际 ${folders.length}）`);
  const km = folders.find((f) => f.name === '课题管理' && !f.parentId);
  const hy = folders.find((f) => f.name === '会议记录' && f.parentId === km?.id);
  assert(!!km && !!hy, 'STUDY 树层级正确（课题管理→会议记录）');
}
/* SITE 分支：引用标准模板下发 ON101/江苏大学附属医院 */
await navTo('SITE TMF');
assert(await clickText('创建目录'), '打开 SITE 目录创建弹窗');
await sleep(600);
assert(await setSelectWithOption('ON101', 'ON101'), 'SITE 选项目 ON101');
await sleep(500);
assert(await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] input')].some((i) => i.value === 'ON101-TMF-江苏大学附属医院')), 'SITE 中心行自动铺出');
assert(await setSelectWithOption('RJQM 标准文件管理体系', 'tt1'), 'SITE 引用种子模板');
await sleep(700);
assert(await bodyHas('标准模板：RJQM 标准文件管理体系'), 'SITE 显示模板芯片');
assert(await bodyHas('将下发到'), 'SITE 预览自动展开');
await shot(275, 'r39c-pm-site-template');
assert(await clickText('确认创建'), 'SITE 确认创建');
await sleep(900);
{
  const d = await readData();
  const cat = d.catalogs?.find((c) => c.kind === 'site' && c.projectNo === 'ON101' && c.center === '江苏大学附属医院');
  assert(!!cat, 'SITE 目录落库（ON101/江苏大学附属医院）');
  const folders = d.files?.filter((f) => f.kind === 'folder' && f.folderId === cat?.id) ?? [];
  assert(folders.length === 33, `SITE 33 个文件夹落库（实际 ${folders.length}）`);
}
/* 绑定 SAE 骨架到「严重不良事件」（供 C/D 段上传验证） */
await drillCatalog('ON101-TMF-江苏大学附属医院');
assert(await clickRowLink('严重不良事件', '绑定骨架'), '严重不良事件 绑骨架');
await sleep(600);
assert(await setSelectWithOption('SAE 上报资料', 'nt2'), '选 nt2');
assert(await clickText('保存', '[role="dialog"]'), '保存绑定');
await sleep(600);
assert((await drillRow('严重不良事件'))?.includes('骨架·SAE 上报资料'), 'SAE 绑定徽标在');

// ═══════════ C. 开启 AI 预填 → CRA SAE 文件预选 + 徽标 ═══════════
console.log('▶ C. AI 预填开启');
await login('admin', '123456');
await navTo('NAMING');
assert(await toggleAi(), '点开 AI 预填开关');
await sleep(600);
{
  const d = await readData();
  assert(d.aiPrefill === true, '开关落库=开');
}
await login('zhanglan', '123456');
await navTo('TRANSFER');
await craOpenUpload();
{
  const fis = await page.$$('[role="dialog"] input[type="file"]');
  await fis[0].uploadFile(SAE_FILE, FREE_FILE);
  await sleep(900);
  for (const n of ['ON101-SAE-20261002.txt', '临时记录-xyz.txt'])
    assert(await rowSetSelect(n, '严重不良事件', '严重不良事件'), `${n} 目标选 严重不良事件`);
  await sleep(900);
  const r1 = await craRow('ON101-SAE-20261002.txt');
  const r2 = await craRow('临时记录-xyz.txt');
  assert(r1?.hasWiz && r2?.hasWiz, '两行均展开向导');
  assert(r1?.docType === 'SAE报告', `SAE 文件预选 SAE报告（实际 ${r1?.docType}）`);
  assert(r1?.aiBadge === true, 'SAE 行显示「AI 预填」徽标');
  assert(r2?.docType === '', `未命中文件不预选（实际 ${r2?.docType}）`);
  assert(r2?.aiBadge === false, '未命中行无徽标');
  assert(r1?.preview === SAE_NAME, `SAE 预览=${SAE_NAME}（实际 ${r1?.preview}）`);
}
await shot(276, 'r39c-cra-ai-prefill');
/* 行2 手选 SAE随访 后确认上传 */
assert(await rowSetSelect('临时记录-xyz.txt', 'SAE随访｜SAE 随访/总结报告', 'SAE随访'), '行2 手选 SAE随访');
await sleep(400);
assert(await clickText('确认上传', '[role="dialog"]'), '确认上传 2 文件');
await sleep(1000);
{
  const d = await readData();
  const f1 = d.files?.find((x) => x.originalFilename === 'ON101-SAE-20261002.txt');
  const f2 = d.files?.find((x) => x.originalFilename === '临时记录-xyz.txt');
  assert(f1?.displayFilename === SAE_NAME && f1?.docType === 'SAE报告' && f1?.namingTemplateId === 'nt2', 'SAE 文件落库正确');
  assert(f2?.displayFilename === FREE_NAME && f2?.docType === 'SAE随访', '未命中文件按手选落库');
  const logs = d.namingLogs ?? [];
  assert(logs.length === 2 && logs.every((l) => l.action === '创建命名'), `审计 2 条创建命名（实际 ${logs.length}）`);
  assert(logs.every((l) => l.projectNo === 'ON101' && l.role === 'executor' && l.originalFilename), '日志冗余字段齐');
}

// ═══════════ D. 关闭开关 → 无预选无徽标 ═══════════
console.log('▶ D. AI 预填关闭');
await login('admin', '123456');
await navTo('NAMING');
assert((await aiSwitch()) === 'checked', '重进开关仍为开（持久化）');
assert(await toggleAi(), '点关 AI 预填开关');
await sleep(600);
{
  const d = await readData();
  assert(d.aiPrefill === false, '开关落库=关');
}
await login('zhanglan', '123456');
await navTo('TRANSFER');
await craOpenUpload();
{
  const fis = await page.$$('[role="dialog"] input[type="file"]');
  await fis[0].uploadFile(SAE_FILE);
  await sleep(900);
  assert(await rowSetSelect('ON101-SAE-20261002.txt', '严重不良事件', '严重不良事件'), '目标选 严重不良事件');
  await sleep(900);
  const r = await craRow('ON101-SAE-20261002.txt');
  assert(r?.hasWiz, '向导仍展开');
  assert(r?.docType === '', `关闭后 SAE 文件不预选（实际 ${r?.docType}）`);
  assert(r?.aiBadge === false, '关闭后无徽标');
}
await shot(277, 'r39c-cra-ai-off');
await page.keyboard.press('Escape');
await sleep(400);
{
  const d = await readData();
  const dup = d.files?.filter((x) => x.originalFilename === 'ON101-SAE-20261002.txt') ?? [];
  assert(dup.length === 1, '取消上传未落库（仍 1 个 SAE 文件）');
}

await browser.close();
console.log(`\n═══ R39 二阶段B 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
