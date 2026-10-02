// 收敛 C1 验证：PM 侧两处「落库即定名」缺口纳入骨架确认制
//   A. 准备：PM 建 ON101 STUDY TMF（引用 tt1）→「课题管理」绑 nt3 会议纪要骨架
//   B. TRANSFER 上传文件夹（带目标文件夹直通）→ 归档弹「归档命名确认」（批量操作条+手动微调）→ 六字段+审计
//   C. TMF 钻取「课题管理」上传 → 横幅/chip →「上传命名确认」（批内重名避让（2）+ 重名追加审计）
//   D. 未绑定目录钻取上传 + TRANSFER 未绑定归档 → 旧流程不动（无确认弹窗、无业务字段、无审计）
//   E. admin AUDIT：PM 记录齐全、PM 徽标、筛选石磊
// DEMO_MODE=false 空白环境；截图 278 起，存工作区根 shots/
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:5199';
const SHOTS = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/shots/';
const UP = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/tmp-upload/';
const BATCH_A = UP + 'batch-a.txt';
const BATCH_C = UP + 'batch-c.txt';
const FREE_FILE = UP + '临时记录-xyz.txt';
const SAE_FILE = UP + 'ON101-SAE-20261002.txt';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const assert = (cond, name) => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ FAIL: ${name}`); }
};
const now = new Date();
const COMPACT = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
const NAME_V2 = `ON101-会议纪要-${COMPACT}-V2.0`;
const NAME_V2_EDIT = `${NAME_V2}-修订`;
const NAME_V1 = `ON101-会议纪要-${COMPACT}-V1.0`;

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
/* 在最后一个匹配 dialog 内按 option 文本选中（值动态时用） */
async function selectOptionByText(optText, scopeSel = '[role="dialog"]') {
  return page.evaluate(({ optText, scopeSel }) => {
    const roots = [...document.querySelectorAll(scopeSel)];
    const root = roots[roots.length - 1];
    if (!root) return false;
    for (const sel of root.querySelectorAll('select')) {
      const opt = [...sel.options].find((o) => o.textContent.trim() === optText);
      if (opt) {
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }, { optText, scopeSel });
}
const readData = () => page.evaluate(() => JSON.parse(localStorage.getItem('clinx-data-v2') || '{}'));
const bodyHas = (t) => page.evaluate((t) => document.body.innerText.includes(t), t);
/* 指定文本特征的 dialog 是否存在（叠放时按内容区分） */
const dlgHas = (dlgText, t) => page.evaluate(({ dlgText, t }) => {
  const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.textContent.includes(dlgText));
  return dlg ? dlg.textContent.includes(t) : false;
}, { dlgText, t });
const dlgExists = (dlgText) => page.evaluate((dlgText) =>
  [...document.querySelectorAll('[role="dialog"]')].some((d) => d.textContent.includes(dlgText)), dlgText);
async function drillCatalog(catName) {
  await page.evaluate((catName) => {
    [...document.querySelectorAll('tbody tr')].find((x) => x.textContent.includes(catName))?.click();
  }, catName);
  await sleep(700);
}
/* 钻取视图内点文件夹名进入下一层 */
async function drillFolder(name) {
  const ok = await page.evaluate((name) => {
    const btn = [...document.querySelectorAll('tbody button')].find((b) => b.textContent.trim() === name);
    if (!btn) return false;
    btn.click();
    return true;
  }, name);
  await sleep(700);
  return ok;
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
/* 确认弹窗（按标题文本定位）行快照：rows=行数、行 i 的 select 值/input 值/chip 文本 */
const cnfRows = (dlgText) => page.evaluate((dlgText) => {
  const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.textContent.includes(dlgText));
  if (!dlg) return null;
  const rows = [...dlg.querySelectorAll('.border-b')].filter((r) => r.querySelector('input'));
  return rows.map((r) => ({
    text: r.textContent.slice(0, 120),
    sels: [...r.querySelectorAll('select')].map((s) => s.value),
    input: r.querySelector('input')?.value ?? '',
    chip: r.textContent.includes('骨架·'),
    inherited: r.textContent.includes('（继承）'),
  }));
}, dlgText);
/* 操作条（含「应用到全部」的容器）：按序设置类型/版本/状态；空串跳过 */
async function bulkSet(dlgText, { type = '', ver = '', status = '' }) {
  return page.evaluate(({ dlgText, type, ver, status }) => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.textContent.includes(dlgText));
    if (!dlg) return false;
    const bar = [...dlg.querySelectorAll('div')].find((d) => d.textContent.includes('应用到全部：') && d.querySelector('select'));
    if (!bar) return false;
    const sels = [...bar.querySelectorAll('select')];
    const setSel = (sel, optText) => {
      const opt = [...sel.options].find((o) => o.textContent.trim() === optText || o.value === optText);
      if (!opt) return false;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
    const ok = [];
    if (type) ok.push(setSel(sels[0], type));
    if (ver) ok.push(setSel(sels[1], ver));
    if (status) ok.push(setSel(sels[2], status));
    return ok.every(Boolean);
  }, { dlgText, type, ver, status });
}
async function bulkApply(dlgText) {
  return page.evaluate((dlgText) => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.textContent.includes(dlgText));
    if (!dlg) return false;
    const bar = [...dlg.querySelectorAll('div')].find((d) => d.textContent.includes('应用到全部：') && d.querySelector('select'));
    const btn = [...(bar?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === '套用');
    if (!btn) return false;
    btn.click();
    return true;
  }, dlgText);
}
/* 手动微调第 i 行预览 input（置 dirty） */
async function setRowPreview(dlgText, i, value) {
  return page.evaluate(({ dlgText, i, value }) => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.textContent.includes(dlgText));
    if (!dlg) return false;
    const rows = [...dlg.querySelectorAll('.border-b')].filter((r) => r.querySelector('input'));
    const el = rows[i]?.querySelector('input');
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, { dlgText, i, value });
}

// ═══════════ A. 准备：ON101 STUDY TMF +「课题管理」绑 nt3 ═══════════
console.log('▶ A. 准备目录与骨架绑定');
await login('shilei', '123456', true);
await navTo('STUDY TMF');
assert(await clickText('创建目录'), '打开 STUDY 目录创建弹窗');
await sleep(600);
assert(await setInput('请输入项目编号', 'ON101'), '填项目编号 ON101');
assert(await setSelectWithOption('RJQM 标准文件管理体系', 'tt1'), '引用种子模板 tt1');
await sleep(600);
assert(await clickText('确认创建'), '确认创建目录');
await sleep(900);
{
  const d = await readData();
  const cat = d.catalogs?.find((c) => c.kind === 'study' && c.projectNo === 'ON101');
  assert(!!cat && cat.name === 'ON101 STUDY TMF', 'ON101 STUDY TMF 落库');
  const folders = d.files?.filter((f) => f.kind === 'folder' && f.folderId === cat?.id) ?? [];
  assert(folders.length === 33, `33 个文件夹物化（实际 ${folders.length}）`);
}
await drillCatalog('ON101 STUDY TMF');
assert(await clickRowLink('课题管理', '绑定骨架'), '课题管理 行点绑定骨架');
await sleep(600);
assert(await setSelectWithOption('会议纪要命名', 'nt3'), '选骨架 nt3 会议纪要命名');
assert(await clickText('保存', '[role="dialog"]'), '保存绑定');
await sleep(600);
assert((await drillRow('课题管理'))?.includes('骨架·会议纪要命名'), '课题管理行骨架徽标在');

// ═══════════ B. TRANSFER 文件夹直通归档 → 归档命名确认（批量） ═══════════
console.log('▶ B. TRANSFER 归档确认制（文件夹直通批量）');
await navTo('TRANSFER');
/* 注入「传输文件夹 + 2 子文件（带 targetFolderId 直通课题管理）」模拟 PM 上传文件夹结果
   （puppeteer uploadFile 对 webkitdirectory 目录输入置空 files，无法驱动系统目录选择；
    注入后走与真实上传完全相同的 archive → 确认弹窗 → confirmArchiveNaming 链路） */
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('clinx-data-v2') || '{}');
  const cat = (d.catalogs ?? []).find((c) => c.kind === 'study' && c.projectNo === 'ON101');
  const km = (d.files ?? []).find((f) => f.kind === 'folder' && f.name === '课题管理' && f.folderId === cat?.id && !f.parentId);
  const t = new Date();
  const ds = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  const base = { projectNo: 'ON101', center: '', uploader: '石磊', uploadDate: ds, status: 'uploaded' };
  d.files = d.files ?? [];
  d.files.push(
    { id: 'upfold-1', name: 'mtg-batch', kind: 'folder', size: '1.0KM', ...base, targetFolderId: km?.id },
    { id: 'upf-1', name: '会议纪要-十月.txt', kind: 'pdf', size: '0.5KM', ...base, parentId: 'upfold-1' },
    { id: 'upf-2', name: '沟通记录-临时.txt', kind: 'pdf', size: '0.5KM', ...base, parentId: 'upfold-1' },
  );
  localStorage.setItem('clinx-data-v2', JSON.stringify(d));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(700);
{
  const d = await readData();
  const folder = d.files?.find((f) => f.id === 'upfold-1');
  assert(!!folder && folder.status === 'uploaded' && !!folder.targetFolderId, '传输文件夹在库（带 targetFolderId 直通标记）');
  const kids = d.files?.filter((f) => f.parentId === 'upfold-1') ?? [];
  assert(kids.length === 2 && kids.every((k) => k.status === 'uploaded'), '2 个子文件待归档');
}
assert((await drillRow('mtg-batch')) !== null, 'TRANSFER 列表出现上传文件夹');
assert(await clickRowLink('mtg-batch', '归档'), '点文件夹行归档按钮');
await sleep(900);
assert(await dlgExists('归档命名确认'), '弹出归档命名确认');
assert(await dlgHas('归档命名确认', '应用到全部'), '批量操作条可见（2 行）');
{
  const rows = await cnfRows('归档命名确认');
  assert(rows?.length === 2, `确认弹窗 2 行（实际 ${rows?.length}）`);
  assert(rows.every((r) => r.chip && r.inherited), '两行均骨架 chip 且标（继承）');
  assert(rows.every((r) => r.sels[0] === ''), '类型初始未选（AI 预填默认关）');
}
/* 操作条：类型=会议纪要、版本=V2.0、状态=终版 → 套用 */
assert(await bulkSet('归档命名确认', { type: '会议纪要', ver: 'V2.0', status: '终版' }), '操作条选型');
assert(await bulkApply('归档命名确认'), '点套用');
await sleep(500);
{
  const rows = await cnfRows('归档命名确认');
  assert(rows[0]?.input === NAME_V2, `行1 预览=${NAME_V2}（实际 ${rows[0]?.input}）`);
}
/* 行2 手动微调预览（置 dirty 琥珀态） */
assert(await setRowPreview('归档命名确认', 1, NAME_V2_EDIT), '行2 手动微调预览');
await sleep(400);
await shot(278, 'c1-transfer-archive-confirm');
assert(await clickText('确认归档'), '点确认归档');
await sleep(1000);
{
  const d = await readData();
  const cat = d.catalogs?.find((c) => c.kind === 'study' && c.projectNo === 'ON101');
  const km = d.files?.find((f) => f.kind === 'folder' && f.name === '课题管理' && f.folderId === cat?.id && !f.parentId);
  const folder = d.files?.find((f) => f.kind === 'folder' && f.uploader === '石磊' && f.targetFolderId);
  assert(folder?.status === 'archived' && folder.parentId === km?.id, '传输文件夹已归档直通到课题管理下');
  const c1 = d.files?.find((f) => f.originalFilename === '会议纪要-十月.txt');
  const c2 = d.files?.find((f) => f.originalFilename === '沟通记录-临时.txt');
  assert(c1?.status === 'archived' && c1.parentId === folder?.id, '子文件1 已归档（保留在传输文件夹内）');
  assert(c1?.displayFilename === NAME_V2 && c1?.name === NAME_V2, `子文件1 命名=${NAME_V2}`);
  assert(c1?.docType === '会议纪要' && c1?.versionNo === '2.0' && c1?.docStatus === '终版' && c1?.namingTemplateId === 'nt3', '子文件1 六字段齐（类型/版本/状态/骨架）');
  assert(c2?.displayFilename === NAME_V2_EDIT, `子文件2 用微调名=${NAME_V2_EDIT}`);
  const logs = (d.namingLogs ?? []).filter((l) => l.role === 'pm');
  assert(logs.length === 2, `namingLogs 2 条 PM 记录（实际 ${logs.length}）`);
  assert(logs.every((l) => l.operator === '石磊' && l.action === '创建命名' && l.projectNo === 'ON101' && l.originalFilename), '日志操作人/动作/项目/原文件名齐');
}
/* TMF 钻取可见：课题管理 → 传输文件夹 → 2 文件展示名 */
await navTo('STUDY TMF');
await drillCatalog('ON101 STUDY TMF');
assert(await drillFolder('课题管理'), '钻取进课题管理');
assert(await drillFolder('mtg-batch'), '钻取进传输文件夹');
assert(await bodyHas(NAME_V2) && await bodyHas(NAME_V2_EDIT), 'TMF 内可见两个确认命名后的展示名');
await shot(279, 'c1-tmf-archived-names');

// ═══════════ C. TMF 钻取上传 → 上传命名确认（批内重名避让） ═══════════
console.log('▶ C. TMF 钻取上传确认制');
/* 回 ON101 根 → 钻课题管理 */
await clickText('ON101 STUDY TMF');
await sleep(600);
assert(await drillFolder('课题管理'), '再次钻取进课题管理');
assert(await clickText('上传'), '钻取视图点上传');
await sleep(700);
assert(await dlgHas('上传到「课题管理」', '目标文件夹已绑定命名骨架'), '钻取上传弹窗 teal 横幅在');
{
  const fi = await page.$('[role="dialog"] input[type="file"]');
  await fi.uploadFile(BATCH_A, BATCH_C);
  await sleep(900);
  /* 绑骨架行 UI：无文档类型 select（chip 替代）、无「→」命名预览行 */
  const stat = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.textContent.includes('上传到「课题管理」'));
    if (!dlg) return null;
    return {
      chips: (dlg.textContent.match(/骨架·会议纪要命名/g) ?? []).length,
      selects: dlg.querySelectorAll('select').length,
      arrowPreview: dlg.textContent.includes('→ ON101'),
    };
  });
  assert(stat && stat.chips >= 3 && stat.selects === 0 && !stat.arrowPreview, '行 UI：骨架 chip 替代类型下拉、无旧命名预览');
}
assert(await clickText('确认上传（2 个文件）'), '点确认上传转命名确认');
await sleep(900);
assert(await dlgExists('上传命名确认'), '弹出上传命名确认');
{
  const rows = await cnfRows('上传命名确认');
  assert(rows?.length === 2 && rows.every((r) => r.chip && !r.inherited), '两行 chip 直绑（无继承标）');
}
assert(await bulkSet('上传命名确认', { type: '会议纪要' }), '操作条选类型');
assert(await bulkApply('上传命名确认'), '点套用');
await sleep(500);
{
  const rows = await cnfRows('上传命名确认');
  assert(rows[0]?.input === NAME_V1 && rows[1]?.input === NAME_V1, '两行渲染同名（批内避让待确认时触发）');
  assert(!(await dlgHas('上传命名确认', '确认时将自动追加')), '批内互撞不亮既有重名警告（警告仅针对目标文件夹现存名）');
}
await shot(280, 'c1-tmf-upload-confirm');
{
  /* 确认弹窗的「确认上传」（无计数括号，leaf 精确匹配） */
  assert(await clickText('确认上传'), '确认上传落库');
  await sleep(1000);
}
{
  const d = await readData();
  const cat = d.catalogs?.find((c) => c.kind === 'study' && c.projectNo === 'ON101');
  const km = d.files?.find((f) => f.kind === 'folder' && f.name === '课题管理' && f.folderId === cat?.id && !f.parentId);
  const f1 = d.files?.find((f) => f.originalFilename === 'batch-a.txt');
  const f2 = d.files?.find((f) => f.originalFilename === 'batch-c.txt');
  assert(f1?.status === 'archived' && f1.parentId === km?.id && f1.folderId === cat?.id, '上传文件1 直接归档进课题管理');
  assert(f1?.displayFilename === NAME_V1 && f1?.docType === '会议纪要' && f1?.versionNo === '1.0' && f1?.docStatus === '草稿' && f1?.namingTemplateId === 'nt3' && f1?.targetFolderId === km?.id, '文件1 六字段落库');
  assert(f2?.displayFilename === `${NAME_V1}（2）`, `批内重名自动（2）（实际 ${f2?.displayFilename}）`);
  const logs = d.namingLogs ?? [];
  assert(logs.length === 4, `审计累计 4 条（实际 ${logs.length}）`);
  const l2 = logs.find((l) => l.originalFilename === 'batch-c.txt');
  assert(l2?.action === '重名追加' && l2?.oldValue === NAME_V1 && l2?.newValue === `${NAME_V1}（2）` && l2?.role === 'pm', '批内避让写「重名追加」审计');
  assert(await bodyHas(NAME_V1), '课题管理内可见新上传文件');
}

// ═══════════ D. 未绑定目录维持旧流程 ═══════════
console.log('▶ D. 未绑定目录旧流程不动');
await clickText('ON101 STUDY TMF');
await sleep(600);
assert(await drillFolder('课题团队'), '钻取进课题团队（未绑骨架）');
assert(await clickText('上传'), '点上传');
await sleep(700);
{
  const banner = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].find((d) => d.textContent.includes('上传到「课题团队」'));
    return dlg ? dlg.textContent.includes('目标文件夹已绑定命名骨架') : null;
  });
  assert(banner === false, '未绑定目录无骨架横幅');
  const fi = await page.$('[role="dialog"] input[type="file"]');
  await fi.uploadFile(FREE_FILE);
  await sleep(900);
  assert(await dlgHas('上传到「课题团队」', '→'), '旧模板命名预览行仍在');
  assert(await clickText('确认上传（1 个文件）'), '确认上传直落');
  await sleep(900);
  assert(!(await dlgExists('上传命名确认')), '无命名确认弹窗');
}
{
  const d = await readData();
  const cat = d.catalogs?.find((c) => c.kind === 'study' && c.projectNo === 'ON101');
  const team = d.files?.find((f) => f.kind === 'folder' && f.name === '课题团队' && f.folderId === cat?.id);
  const f = d.files?.find((f) => f.parentId === team?.id && f.uploader === '石磊');
  assert(!!f && f.status === 'archived' && !f.namingTemplateId && !f.docType && !f.displayFilename, '旧流程落库无骨架业务字段');
  assert((d.namingLogs ?? []).length === 4, '审计不新增（仍 4 条）');
}
/* TRANSFER 归档到未绑定路由目标：无确认弹窗 */
await navTo('TRANSFER');
assert(await clickText('上传'), '打开上传下拉');
await sleep(400);
assert(await clickText('上传文件'), '点上传文件');
await sleep(700);
assert(await setSelectWithOption('ON101', 'ON101'), '选项目 ON101（不选目标文件夹）');
await sleep(500);
{
  const fi = await page.$('[role="dialog"] input[type="file"]');
  await fi.uploadFile(SAE_FILE);
  await sleep(1000);
  const d = await readData();
  const f = [...(d.files ?? [])].reverse().find((x) => x.uploader === '石磊' && x.status === 'uploaded' && x.kind !== 'folder');
  assert(!!f, 'SAE 文件落库待归档');
  assert(await clickRowLink(f.name.slice(0, 10), '归档') || await page.evaluate((id) => {
    /* 兜底：按行内任意单元格包含文件名找归档按钮 */
    const rows = [...document.querySelectorAll('tbody tr')];
    const r = rows.find((x) => x.textContent.includes(id));
    const b = r ? [...r.querySelectorAll('button')].find((b) => b.textContent.trim() === '归档') : null;
    if (!b) return false;
    b.click();
    return true;
  }, f.name), '点 SAE 文件归档');
  await sleep(900);
  assert(!(await dlgExists('归档命名确认')), '未绑定路由目标无确认弹窗');
  await sleep(500);
  const d2 = await readData();
  const f2 = d2.files?.find((x) => x.id === f.id);
  assert(f2?.status === 'archived', 'SAE 文件按路由表直接归档');
  assert((d2.namingLogs ?? []).length === 4, '审计仍 4 条（路由归档不写命名审计）');
}

// ═══════════ E. 目标文件夹既有重名 → 行内警告 + 序号递增（3） ═══════════
console.log('▶ E. 既有重名避让');
await navTo('STUDY TMF');
await drillCatalog('ON101 STUDY TMF');
assert(await drillFolder('课题管理'), '钻取进课题管理');
assert(await clickText('上传'), '点上传');
await sleep(700);
{
  const fi = await page.$('[role="dialog"] input[type="file"]');
  await fi.uploadFile(UP + 'batch-b.txt');
  await sleep(900);
  assert(await clickText('确认上传（1 个文件）'), '确认上传转命名确认');
  await sleep(900);
  assert(await dlgExists('上传命名确认'), '弹出上传命名确认（单行）');
  assert(!(await dlgHas('上传命名确认', '应用到全部')), '单行无批量操作条');
  assert(await selectOptionByText('会议纪要｜会议纪要/沟通记录'), '行内选类型 会议纪要');
  await sleep(500);
  const rows = await cnfRows('上传命名确认');
  assert(rows[0]?.input === NAME_V1, `预览=${NAME_V1}（与文件夹现存名撞）`);
  assert(await dlgHas('上传命名确认', '已存在同名文件，确认时将自动追加'), '既有重名警告亮起');
  await shot(281, 'c1-dup-warn-existing');
  assert(await clickText('确认上传'), '确认上传落库');
  await sleep(1000);
  const d = await readData();
  const f = d.files?.find((x) => x.originalFilename === 'batch-b.txt');
  assert(f?.displayFilename === `${NAME_V1}（3）`, `序号递增避让（3）（实际 ${f?.displayFilename}）`);
  const logs = d.namingLogs ?? [];
  assert(logs.length === 5, `审计累计 5 条（实际 ${logs.length}）`);
  const l = logs.find((x) => x.originalFilename === 'batch-b.txt');
  assert(l?.action === '重名追加' && l?.oldValue === NAME_V1 && l?.newValue === `${NAME_V1}（3）`, '避让（3）写「重名追加」审计');
}

// ═══════════ F. admin AUDIT 查验 ═══════════
console.log('▶ F. admin AUDIT');
await login('admin', '123456');
await navTo('AUDIT');
assert(await bodyHas('共 5 条'), '审计总览 5 条');
assert(await bodyHas('创建命名') && await bodyHas('重名追加'), '动作三色口径在（创建命名/重名追加）');
assert(await setSelectWithOption('石磊', '石磊', 'main'), '筛选操作人石磊');
await sleep(600);
assert(await bodyHas('共 5 条'), '石磊筛后仍 5 条（全部 PM 记录）');
{
  const pmBadges = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tbody tr')];
    return rows.filter((r) => r.textContent.includes('石磊') && r.textContent.includes('PM')).length;
  });
  assert(pmBadges === 5, `5 行均带 PM 角色徽标（实际 ${pmBadges}）`);
  const origNames = await page.evaluate(() => document.body.innerText.includes('batch-c.txt') && document.body.innerText.includes('会议纪要-十月.txt'));
  assert(origNames, '原文件名列可见（溯源）');
}
await shot(282, 'c1-admin-audit-pm');

await browser.close();
console.log(`\n═══ 收敛 C1 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
