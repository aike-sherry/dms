// R39 一阶段验证：模式A「目录绑定命名范式」
//   admin 骨架库/字典 → PM 钻取绑定/继承/换绑/解绑 → CRA 上传命名向导（重名追加）→ 存量文件名稳定
// DEMO_MODE=false 空白环境；截图 249 起，存工作区根 shots/
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:5199';
const SHOTS = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/shots/';
const RJQM = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/RJQM-文件管理体系.xlsx';
const TXT = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/tmp-upload/minutes-draft.txt';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const assert = (cond, name) => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ FAIL: ${name}`); }
};
const now = new Date();
const COMPACT = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
const R = `ON101-会议纪要-${COMPACT}-V1.0`; // nt3 骨架渲染的期望文件名

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
  /* 多账号串测：先清会话再整页 reload（hash 跳转不重载 React，内存中的登录态会把登录页重定向走） */
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
/* 弹窗内文本输入框按 placeholder 赋值 */
async function setInput(ph, value) {
  return page.evaluate(({ ph, value }) => {
    const el = [...document.querySelectorAll('[role="dialog"] input')].find((i) => i.placeholder === ph);
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, { ph, value });
}
/* 在 scope 内找「选项里含 optText」的 select 并赋值为 value；scope 不存在时不回退 body（防误匹配页面筛选） */
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
/* HOME 走 UI 新增中心 */
async function addCenterUI(proj, name, cra) {
  assert(await clickText('新增中心'), `打开新增中心弹窗（${name}）`);
  await sleep(500);
  assert(await setInput('请输入项目编号', proj), `填写项目编号 ${proj}`);
  assert(await setInput('请输入研究中心名称', name), `填写中心名称 ${name}`);
  assert(await setSelectWithOption(cra, cra), `选择 CRA ${cra}`);
  assert(await clickText('确认新增', '[role="dialog"]'), `确认新增 ${name}`);
  await sleep(500);
}
/* 钻取表内找名称行（首列文本以 name 开头） */
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
/* 钻入 SITE 目录详情（点击目录行） */
async function drillCatalog(catName) {
  await page.evaluate((catName) => {
    const r = [...document.querySelectorAll('tbody tr')].find((x) => x.textContent.includes(catName));
    r?.click();
  }, catName);
  await sleep(700);
}
/* CRA 上传对话框：选项目 + 中心 + 上传 txt（「上传」直取 BUTTON，页面表头有同文本 span 干扰） */
async function craStartUpload() {
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
  assert(await setSelectWithOption('江苏大学附属医院', '江苏大学附属医院'), '对话框选中心 江苏大学附属医院');
  await sleep(400);
  const fis = await page.$$('[role="dialog"] input[type="file"]');
  assert(fis.length >= 1, '文件 input 就位');
  await fis[0].uploadFile(TXT);
  await sleep(800);
}
/* CRA 行快照：目标文档值/向导存在/徽标/预览值/类型选项 */
const craRowSnap = () => page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return null;
  const row = [...dlg.querySelectorAll('.border-b')].find((r) => r.textContent.includes('minutes-draft.txt'));
  if (!row) return null;
  const sels = [...row.querySelectorAll('select')];
  const target = sels[0];
  const wizType = sels.find((s) => [...s.options].some((o) => o.value === '会议纪要'));
  const input = row.querySelector('input');
  return {
    targetVal: target?.value ?? '',
    hasWiz: !!wizType,
    badge: row.querySelector('span[title]')?.textContent.trim() ?? '',
    typeOpts: wizType ? [...wizType.options].map((o) => o.value) : [],
    preview: input?.value ?? '',
    oldPreview: row.querySelector('.break-all')?.textContent.trim() ?? '',
    dupHint: row.textContent.includes('已存在同名文件'),
    needType: row.textContent.includes('请选择文档类型后才能确认上传'),
  };
});
async function craSetRow(optText, value) {
  return page.evaluate(({ optText, value }) => {
    const dlg = document.querySelector('[role="dialog"]');
    const row = [...dlg.querySelectorAll('.border-b')].find((r) => r.textContent.includes('minutes-draft.txt'));
    if (!row) return false;
    const sel = [...row.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.trim() === optText || o.value === optText));
    if (!sel) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { optText, value });
}
async function craSetPreview(value) {
  return page.evaluate((value) => {
    const dlg = document.querySelector('[role="dialog"]');
    const row = [...dlg.querySelectorAll('.border-b')].find((r) => r.textContent.includes('minutes-draft.txt'));
    const input = row?.querySelector('input');
    if (!input) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, value);
}

// ═══════════ A. admin：骨架库 + 字典 ═══════════
console.log('▶ A. admin NAMING 页');
await login('admin', '123456', true);
await navTo('NAMING');
assert(await bodyHas('命名范式骨架库') && await bodyHas('文档类型字典'), '页面两个卡片标题');
for (const n of ['方案类文件命名', 'SAE 上报资料', '会议纪要命名', '访视报告命名（停用示例）'])
  assert(await bodyHas(n), `种子骨架在列：${n}`);
assert(await bodyHas('{试验编号}'), '骨架占位符高亮渲染');
await shot(249, 'r39-admin-naming-seeds');

// A2 新增骨架（chips 插入 + 实时预览）
assert(await clickText('新增骨架'), '打开新增骨架弹窗');
await sleep(500);
assert(await clickText('{试验编号}', '[role="dialog"]'), 'chip 插入 {试验编号}');
assert(await setInput('如：方案类文件命名', '稽查文件命名'), '填写骨架名称');
assert(await setInput('{试验编号}-{文件类型简称}-V{版本号}-{YYYYMMDD}', '{试验编号}-{中心编号}-{文件类型简称}'), '填写骨架字符串');
assert(await clickText('{YYYYMMDD}', '[role="dialog"]'), 'chip 追加 {YYYYMMDD}');
await sleep(300);
assert(await bodyHas('ON101CL01'), '弹窗实时示例预览');
assert(await clickText('保存', '[role="dialog"]'), '保存新骨架');
await sleep(600);
assert(await bodyHas('稽查文件命名'), '新骨架出现在列表');
await shot(250, 'r39-admin-template-added');

// A3 停用 nt1
assert(await clickRowLink('方案类文件命名', '停用'), '停用 nt1');
await sleep(500);
{
  const row = await drillRow('方案类文件命名');
  assert(!!row && row.includes('停用'), 'nt1 状态变为停用');
}
await shot(251, 'r39-admin-template-disabled');

// A4 字典新增 + 编辑
assert(await clickText('新增类型'), '打开新增类型弹窗');
await sleep(500);
assert(await setInput('如：方案', '稽查报告'), '填写简称');
assert(await setInput('如：临床试验方案', '稽查报告（QA）'), '填写全称');
assert(await setInput('如：SAE', '稽查'), '填写分类');
assert(await clickText('保存', '[role="dialog"]'), '保存新类型');
await sleep(600);
assert(await bodyHas('稽查报告（QA）'), '新类型出现在字典');
{
  const ok = await page.evaluate(() => {
    const r = [...document.querySelectorAll('tbody tr')].find((x) => x.querySelector('td')?.textContent.trim() === '简历');
    r?.querySelector('button[title="编辑"]')?.click();
    return !!r;
  });
  assert(ok, '打开字典编辑（简历）');
  await sleep(500);
  assert(await setInput('如：临床试验方案', '研究者简历（CV）'), '修改全称');
  assert(await clickText('保存', '[role="dialog"]'), '保存字典编辑');
  await sleep(600);
  assert(await bodyHas('研究者简历（CV）'), '字典编辑生效');
}
await shot(252, 'r39-admin-dict');
{
  const d = await readData();
  assert(d.namingTemplates?.length === 5, `骨架库落库 5 条（实际 ${d.namingTemplates?.length}）`);
  assert(d.docTypes?.length === 11, `字典落库 11 条（实际 ${d.docTypes?.length}）`);
  assert(d.namingTemplates?.find((t) => t.id === 'nt1')?.status === '停用', 'nt1 落库为停用');
}

// ═══════════ B. PM：建中心/目录 + 钻取绑定 ═══════════
console.log('▶ B. PM 绑定');
await login('shilei', '123456');
// 注入 STUDY 目录（CRA 上传对话框项目编号数据源）后整页 reload 让其 hydrate（hash 跳转不重载，内存态会回写覆盖注入）
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
  const d = await readData();
  const cat = d.catalogs?.find((c) => c.kind === 'site' && c.center === '江苏大学附属医院');
  const folders = d.files?.filter((f) => f.kind === 'folder' && f.folderId === cat?.id) ?? [];
  assert(!!cat && folders.length === 33, `SITE 目录 33 文件夹落库（实际 ${folders.length}）`);
}
await shot(253, 'r39-pm-site-created');
await page.keyboard.press('Escape');
await sleep(400);

// B2 钻取 → 课题管理 绑定 nt3
await drillCatalog('ON101-TMF-江苏大学附属医院');
assert(!!(await drillRow('课题管理')), '钻取内看到 课题管理 文件夹');
assert(await clickRowLink('课题管理', '绑定骨架'), '课题管理 行点绑定骨架');
await sleep(600);
assert(await bodyHas('本目录及上级均未绑定骨架'), '弹窗显示未绑定态');
{
  const opts = await page.evaluate(() => {
    const sel = document.querySelector('[role="dialog"] select');
    return sel ? [...sel.options].map((o) => o.textContent.trim()) : [];
  });
  assert(opts.includes('会议纪要命名') && opts.includes('SAE 上报资料'), '下拉列出启用中骨架');
  assert(!opts.includes('方案类文件命名') && !opts.some((o) => o.includes('访视报告')), '停用骨架不在下拉（nt1/nt4）');
}
assert(await setSelectWithOption('会议纪要命名', 'nt3'), '选择 会议纪要命名');
assert(await clickText('保存', '[role="dialog"]'), '保存绑定');
await sleep(600);
{
  const row = await drillRow('课题管理');
  assert(!!row && row.includes('骨架·会议纪要命名'), '课题管理 行出现 teal 绑定徽标');
}
await shot(254, 'r39-pm-bind-badge');

// B3 进入 课题管理：子目录继承徽标
await page.evaluate(() => {
  const r = [...document.querySelectorAll('tbody tr')].find((x) => x.querySelector('td')?.textContent.trim().startsWith('课题管理'));
  [...r.querySelectorAll('button')].find((b) => b.textContent.trim() === '课题管理')?.click();
});
await sleep(700);
{
  const r1 = await drillRow('会议记录');
  const r2 = await drillRow('沟通材料');
  assert(!!r1 && r1.includes('继承·会议纪要命名'), '会议记录 显示继承徽标');
  assert(!!r2 && r2.includes('继承·会议纪要命名'), '沟通材料 显示继承徽标');
}
await shot(255, 'r39-pm-inherit-badges');

// B4 会议记录 覆盖绑定 nt2 → 解绑 → 回到继承
assert(await clickRowLink('会议记录', '绑定骨架'), '会议记录 行点绑定骨架');
await sleep(600);
assert(await bodyHas('继承自：课题管理'), '弹窗提示继承自 课题管理');
assert(await setSelectWithOption('SAE 上报资料', 'nt2'), '覆盖选择 SAE 上报资料');
assert(await clickText('保存', '[role="dialog"]'), '保存覆盖绑定');
await sleep(600);
{
  const row = await drillRow('会议记录');
  assert(!!row && row.includes('骨架·SAE 上报资料'), '会议记录 变为本目录绑定徽标');
}
assert(await clickRowLink('会议记录', '绑定骨架'), '再次打开绑定弹窗');
await sleep(600);
assert(await clickText('解绑本目录', '[role="dialog"]'), '解绑本目录');
await sleep(600);
{
  const row = await drillRow('会议记录');
  assert(!!row && row.includes('继承·会议纪要命名') && !row.includes('骨架·SAE'), '解绑后回到继承徽标');
}
await shot(256, 'r39-pm-rebind-inherit');

// ═══════════ C. CRA：上传命名向导 ═══════════
console.log('▶ C. CRA 命名向导');
await login('zhanglan', '123456');
await navTo('TRANSFER');

// C1 首次上传：向导渲染 + 字段落库
await craStartUpload();
{
  let s = await craRowSnap();
  assert(!!s, '确认命名区出现文件行');
  assert(await craSetRow('课题管理', '课题管理'), '目标文档选 课题管理');
  await sleep(700);
  s = await craRowSnap();
  assert(s?.hasWiz, '向导区展开（命中绑定骨架）');
  assert(s?.badge === '骨架·会议纪要命名', `行内骨架徽标（实际 ${s?.badge}）`);
  assert(s?.typeOpts.length === 2 && s?.typeOpts.includes('会议纪要'), `类型下拉仅限定类型（实际 ${s?.typeOpts.join('|')}）`);
  assert(s?.needType, '未选类型时确认拦截提示');
  assert(await craSetRow('会议纪要', '会议纪要'), '向导选文档类型 会议纪要');
  await sleep(500);
  s = await craRowSnap();
  assert(s?.preview === R, `骨架实时预览=${R}（实际 ${s?.preview}）`);
}
await shot(257, 'r39-cra-wizard');
assert(await clickText('确认上传', '[role="dialog"]'), '确认上传 #1');
await sleep(900);
{
  const d = await readData();
  const f = d.files?.find((x) => x.namingTemplateId === 'nt3' && x.kind === 'pdf');
  assert(!!f, '落库文件带 namingTemplateId=nt3');
  assert(f?.originalFilename === 'minutes-draft.txt', `originalFilename=原始文件名（实际 ${f?.originalFilename}）`);
  assert(f?.displayFilename === R && f?.name === R, `displayFilename/name=骨架渲染名（实际 ${f?.displayFilename}）`);
  assert(f?.versionNo === '1.0' && f?.docStatus === '草稿' && f?.docType === '会议纪要', `业务字段落库（${f?.versionNo}/${f?.docStatus}/${f?.docType}）`);
  const logs = d.namingLogs?.filter((l) => l.fileId === f?.id) ?? [];
  assert(logs.length === 1 && logs[0].action === '创建命名' && logs[0].newValue === R && logs[0].operator === '张兰', '命名审计日志（创建命名）');
}
await shot(258, 'r39-cra-uploaded');

// C2 同名再传：手动覆盖为同名 → 重名提示 → 自动追加（2）
await craStartUpload();
{
  assert(await craSetRow('课题管理', '课题管理'), '目标文档再选 课题管理');
  await sleep(700);
  assert(await craSetRow('会议纪要', '会议纪要'), '向导再选 会议纪要');
  await sleep(500);
  let s = await craRowSnap();
  assert(s?.dupHint, '重名 amber 提示（确认时自动追加（2））');
  assert(await craSetPreview(R), '手动覆盖预览为同名');
  await sleep(400);
  s = await craRowSnap();
  assert(s?.preview === R && s?.dupHint, '覆盖后仍为同名 + 提示保留');
}
await shot(259, 'r39-cra-dup-hint');
assert(await clickText('确认上传', '[role="dialog"]'), '确认上传 #2');
await sleep(900);
{
  const d = await readData();
  const f2 = d.files?.find((x) => x.namingTemplateId === 'nt3' && x.displayFilename === `${R}（2）`);
  assert(!!f2, `重名自动追加（2）（实际 ${d.files?.filter((x) => x.namingTemplateId === 'nt3').map((x) => x.displayFilename).join('|')}）`);
  assert((d.namingLogs?.length ?? 0) >= 2, '第二条命名审计日志');
}

// C3 未绑定目录上传：无向导（走旧预览）
await craStartUpload();
{
  assert(await craSetRow('课题团队', '课题团队'), '目标文档选 课题团队（未绑定）');
  await sleep(700);
  const s = await craRowSnap();
  assert(!!s && !s.hasWiz && s.badge === '', '未绑定目录不出现向导/徽标');
  assert(s?.oldPreview !== '', `旧模板预览仍在（实际 ${s?.oldPreview}）`);
}
await shot(260, 'r39-cra-unbound-row');
assert(await clickText('取消', '[role="dialog"]'), '取消第三个上传');
await sleep(500);

// ═══════════ D. PM 换绑：存量文件名不变 ═══════════
console.log('▶ D. PM 换绑存量稳定');
await login('shilei', '123456');
await navTo('SITE TMF');
await drillCatalog('ON101-TMF-江苏大学附属医院');
assert(await clickRowLink('课题管理', '绑定骨架'), '课题管理 再次打开绑定弹窗');
await sleep(600);
assert(await setSelectWithOption('SAE 上报资料', 'nt2'), '换绑 SAE 上报资料');
assert(await clickText('保存', '[role="dialog"]'), '保存换绑');
await sleep(600);
{
  const row = await drillRow('课题管理');
  assert(!!row && row.includes('骨架·SAE 上报资料'), '换绑徽标生效');
  const d = await readData();
  const names = d.files?.filter((x) => x.namingTemplateId === 'nt3' && x.kind === 'pdf').map((x) => x.displayFilename).sort() ?? [];
  assert(names.length === 2 && names[0] === R && names[1] === `${R}（2）`, `存量文件名不受换绑影响（实际 ${names.join('|')}）`);
}
await shot(261, 'r39-pm-rebind-stable');

await browser.close();
console.log(`\n═══ R39 一阶段验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
