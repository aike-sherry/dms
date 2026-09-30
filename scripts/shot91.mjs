// R38 验证：SITE 目录创建弹窗自动铺出注册表中心行（HOME 新增中心 → 弹窗选项目即成行）
// DEMO_MODE=false 空白环境；截图 242 起，存工作区根 shots/
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:5199';
const SHOTS = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/shots/';
const RJQM = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/RJQM-文件管理体系.xlsx';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const assert = (cond, name) => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ FAIL: ${name}`); }
};

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
  if (fresh) await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
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
/* 原生 select 赋值（React 受控） */
async function setSelect(selSelector, value) {
  return page.evaluate(({ selSelector, value }) => {
    const sel = document.querySelector(selSelector);
    if (!sel) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { selSelector, value });
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
const readData = () => page.evaluate(() => JSON.parse(localStorage.getItem('clinx-data-v2') || '{}'));
const bodyHas = (t) => page.evaluate((t) => document.body.innerText.includes(t), t);
/* 弹窗 SITE 行快照：center=行内 select 值、name=名称输入框值、badge=徽标存在 */
const siteRowSnap = () => page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return null;
  const rows = [...dlg.querySelectorAll('tbody tr')].filter((r) => r.querySelector('select'));
  return rows.map((r) => ({
    center: r.querySelector('select')?.value ?? '',
    opts: [...r.querySelectorAll('select option')].map((o) => o.textContent.trim()),
    name: r.querySelector('input')?.value ?? '',
    badge: r.textContent.includes('已建目录，将合并导入'),
  }));
});
/* HOME 走 UI 新增中心 */
async function addCenterUI(proj, name, cra) {
  assert(await clickText('新增中心'), `打开新增中心弹窗（${name}）`);
  await sleep(500);
  assert(await setInput('请输入项目编号', proj), `填写项目编号 ${proj}`);
  assert(await setInput('请输入研究中心名称', name), `填写中心名称 ${name}`);
  assert(await setSelect('[role="dialog"] select', cra), `选择 CRA ${cra}`);
  assert(await clickText('确认新增', '[role="dialog"]'), `确认新增 ${name}`);
  await sleep(500);
}

// ═══════════ 0. 空白环境登录 PM ═══════════
console.log('▶ 0. 空白环境登录');
await login('shilei', '123456', true);

// ═══════════ 1. HOME 走 UI 新增中心（ON101 · 江苏大学附属医院 · 张兰） ═══════════
console.log('▶ 1. HOME 新增中心');
await navTo('HOME');
await addCenterUI('ON101', '江苏大学附属医院', '张兰');
await shot(242, 'r38-home-add-center');
let d = await readData();
assert(d.centers?.length === 1 && d.centers[0].name === '江苏大学附属医院' && d.centers[0].projectNo === 'ON101' && d.centers[0].cra === '张兰',
  `注册表落库（实际 ${JSON.stringify(d.centers)}）`);

// ═══════════ 2. SITE 创建目录：选项目自动铺行 ═══════════
console.log('▶ 2. 弹窗自动铺行');
await navTo('SITE TMF');
assert(await clickText('创建目录'), '打开 SITE 目录创建弹窗');
await sleep(600);
assert(await setSelect('[role="dialog"] select', 'ON101'), '选择项目 ON101');
await sleep(400);
let rows = await siteRowSnap();
assert(rows?.length === 1, `自动铺出 1 行（实际 ${rows?.length}）`);
assert(rows?.[0].center === '江苏大学附属医院', `行中心=注册表中心（实际 ${rows?.[0].center}）`);
assert(rows?.[0].name === 'ON101-TMF-江苏大学附属医院', `TMF 名称自动生成（实际 ${rows?.[0].name}）`);
await shot(243, 'r38-auto-rows');

// ═══════════ 3. ⊕ 互斥拦截 + 删行后补行下拉只列注册表中心 ═══════════
console.log('▶ 3. 行操作');
await clickText('研究中心（点击添加）');
await sleep(400);
assert(await bodyHas('该项目下的研究中心已全部添加'), '⊕ 互斥拦截 toast（已全部添加）');
rows = await siteRowSnap();
assert(rows?.length === 1, '拦截后仍 1 行');
/* 删除行 → 空态引导文案 */
await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  [...dlg.querySelectorAll('tbody tr button')].find((b) => b.title === '删除该行')?.click();
});
await sleep(400);
assert(await bodyHas('可先到首页「研究中心管理」新增'), '删空后空态引导文案');
/* 补行：下拉只列注册表中心，选中即自动命名 */
await clickText('研究中心（点击添加）');
await sleep(400);
rows = await siteRowSnap();
assert(rows?.length === 1 && rows[0].center === '', '补出 1 空行');
assert(rows?.[0].opts.some((o) => o.includes('江苏大学附属医院')) && rows[0].opts.length === 2, `空行下拉=注册表中心（实际 ${rows?.[0].opts.join('|')}）`);
await page.evaluate(() => {
  const sel = document.querySelector('[role="dialog"] tbody tr select');
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, '江苏大学附属医院');
  sel.dispatchEvent(new Event('change', { bubbles: true }));
});
await sleep(400);
rows = await siteRowSnap();
assert(rows?.[0].name === 'ON101-TMF-江苏大学附属医院', '补行选中后名称自动生成');
await shot(244, 'r38-row-ops');

// ═══════════ 4. 上传 RJQM → 确认创建 → 落库到该中心 ═══════════
console.log('▶ 4. 上传创建');
assert(await clickText('上传目录', '[role="dialog"]'), '点上传目录（ref 就位）');
await sleep(300);
const fi = await page.$('[role="dialog"] input[type="file"]');
await fi.uploadFile(RJQM);
await sleep(1200);
assert(await bodyHas('一级 13 · 二级 20'), 'RJQM 解析计数');
assert(await bodyHas('将下发到') && (await bodyHas('ON101-TMF-江苏大学附属医院')), '预览面板目标名称');
await shot(245, 'r38-upload-preview');
assert(await clickText('确认创建'), '确认创建');
await sleep(700);
assert(await bodyHas('目录创建完成'), '创建 toast');
d = await readData();
const cat = d.catalogs?.find((c) => c.kind === 'site' && c.center === '江苏大学附属医院');
assert(!!cat && cat.name === 'ON101-TMF-江苏大学附属医院', `目录落库到该中心（实际 ${cat?.name}）`);
const folders = d.files?.filter((f) => f.kind === 'folder' && f.folderId === cat?.id) ?? [];
assert(folders.length === 33, `33 个文件夹落库（实际 ${folders.length}）`);
await shot(246, 'r38-created-toast');

// ═══════════ 5. 重开弹窗：该行标「已建目录，将合并导入」 ═══════════
console.log('▶ 5. 已建目录标记');
assert(await clickText('创建目录'), '重开创建弹窗');
await sleep(600);
await setSelect('[role="dialog"] select', 'ON101');
await sleep(400);
rows = await siteRowSnap();
assert(rows?.length === 1 && rows[0].center === '江苏大学附属医院' && rows[0].badge, `已建目录徽标（badge=${rows?.[0].badge}）`);
assert(rows?.[0].opts.some((o) => o.includes('（已建目录）')), '下拉选项标（已建目录）');
await shot(247, 'r38-built-badge');
await page.keyboard.press('Escape');
await sleep(400);

// ═══════════ 6. 第二家中心：多行自动铺出 ═══════════
console.log('▶ 6. 双中心铺行');
await navTo('HOME');
await addCenterUI('ON101', '上海瑞金医院', '张兰');
await navTo('SITE TMF');
assert(await clickText('创建目录'), '再开创建弹窗');
await sleep(600);
await setSelect('[role="dialog"] select', 'ON101');
await sleep(400);
rows = await siteRowSnap();
const names = (rows ?? []).map((r) => r.center).sort();
assert(rows?.length === 2 && names.includes('上海瑞金医院') && names.includes('江苏大学附属医院'), `两行自动铺出（实际 ${names.join('|')}）`);
assert(rows?.find((r) => r.center === '江苏大学附属医院')?.badge === true, '已建中心保留徽标');
assert(rows?.find((r) => r.center === '上海瑞金医院')?.badge === false, '新中心无徽标');
await shot(248, 'r38-two-centers');

await browser.close();
console.log(`\n═══ R38 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
