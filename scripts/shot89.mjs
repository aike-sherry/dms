// R36 验证：执行端 SITE TMF 逐级下钻修复（一级→二级→三级 + 面包屑回跳 + 文件下载）+ PM 端回归
// DEMO_MODE=false 空白环境；截图 231 起，存工作区根 shots/
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

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
  args: ['--window-size=1612,900'],
  defaultViewport: { width: 1517, height: 800 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

async function login(pg, u, p, fresh = false) {
  await pg.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
  if (fresh) await pg.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await pg.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  await sleep(300);
  await pg.evaluate(({ u, p }) => {
    const inputs = [...document.querySelectorAll('input')];
    const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(inputs[0], u); set(inputs[1], p);
    [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s/g, '') === '登录')?.click();
  }, { u, p });
  await pg.waitForFunction(() => !!sessionStorage.getItem('clinx-auth'), { timeout: 8000 });
  await sleep(400);
}
async function navTo(pg, name) {
  await pg.evaluate((name) => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim().toUpperCase() === name.toUpperCase())?.click();
  }, name);
  await sleep(700);
}
async function clickText(pg, text, scope = 'body') {
  return pg.evaluate(({ text, scope }) => {
    const root = scope === 'body' ? document.body : document.querySelector(scope);
    if (!root) return false;
    const els = [...root.querySelectorAll('button, a, [role="button"], span, div, td, th, label')];
    let el = els.find((e) => e.children.length === 0 && e.textContent.trim() === text);
    if (!el) el = els.find((e) => (e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') && e.textContent.trim() === text);
    if (el) { el.click(); return true; }
    return false;
  }, { text, scope });
}
const bodyHas = (pg, t) => pg.evaluate((t) => document.body.innerText.includes(t), t);
const readData = (pg) => pg.evaluate(() => JSON.parse(localStorage.getItem('clinx-data-v2') || '{}'));
async function setSelect(pg, selSelector, value) {
  return pg.evaluate(({ selSelector, value }) => {
    const sel = document.querySelector(selSelector);
    if (!sel) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { selSelector, value });
}
const shot = async (pg, num, name) => {
  await pg.screenshot({ path: `${SHOTS}${num}-${name}.png` });
  console.log(`  📸 ${num}-${name}.png`);
};
/* 目录行点击进入钻取（点行名称单元格） */
async function clickCatalogRow(pg, name) {
  return pg.evaluate((name) => {
    const tb = [...document.querySelectorAll('table')].find((t) => t.querySelector('thead')?.textContent.includes('名称'));
    const row = tb && [...tb.querySelectorAll('tbody tr')].find((r) => r.innerText.includes(name));
    if (!row) return false;
    row.querySelector('td')?.click();
    return true;
  }, name);
}
/* 钻取表格内点击文件夹名下钻（目录表 tbody 内的文件夹按钮） */
async function drillInto(pg, folderName) {
  return pg.evaluate((folderName) => {
    const tb = [...document.querySelectorAll('table')].find((t) => t.querySelector('thead')?.textContent.includes('名称'));
    const btn = tb && [...tb.querySelectorAll('tbody button')].find((b) => b.textContent.trim() === folderName);
    if (!btn) return false;
    btn.click();
    return true;
  }, folderName);
}
/* 面包屑点击回跳（面包屑容器内的按钮） */
async function breadcrumbTo(pg, name) {
  return pg.evaluate((name) => {
    const crumb = [...document.querySelectorAll('div')].find((d) => d.className.includes('mb-4') && d.textContent.includes('SITE TMF'));
    if (!crumb) return false;
    const btn = [...crumb.querySelectorAll('button')].find((b) => b.textContent.trim() === name);
    if (!btn) return false;
    btn.click();
    return true;
  }, name);
}
const crumbText = (pg) =>
  pg.evaluate(() => {
    const crumb = [...document.querySelectorAll('div')].find((d) => d.className.includes('mb-4') && d.textContent.includes('SITE TMF'));
    return crumb ? crumb.innerText.replace(/\s+/g, ' ').trim() : '';
  });
/* 目录表格行名（页面另常驻管理表格，取表头含「文件名称」的那张——管理表表头无此列） */
const tableNames = (pg) =>
  pg.evaluate(() => {
    const tb = [...document.querySelectorAll('table')].find((t) => t.querySelector('thead')?.textContent.includes('名称'));
    return tb ? [...tb.querySelectorAll('tbody tr')].map((r) => r.querySelector('td')?.innerText.trim() ?? '') : [];
  });
/* 钻取表居中规范断言 */
const drillCentered = (pg, label) =>
  pg.evaluate(() => {
    const cells = [...document.querySelectorAll('tbody tr td, thead th')].filter((el) => el.getClientRects().length);
    const bad = cells.filter((el) => getComputedStyle(el).textAlign !== 'center').length;
    return { cells: cells.length, bad };
  }).then((r) => assert(r.bad === 0, `${label}：${r.cells} 个 th/td 全部居中（规范）`));

// ═══════════ 0. 空白环境 + 注册表 + STUDY 目录（PM 回归用，含层级与归档文件） ═══════════
console.log('▶ 0. 环境准备');
await login(page, 'shilei', '123456', true);
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('clinx-data-v2') || '{}');
  d.centers = [
    { id: 'ct1', name: '上海瑞金医院', projectNo: 'ON101CL103', cra: '张兰' },
    { id: 'ct2', name: '北京协和医院', projectNo: 'ON101CL103', cra: '李华' },
  ];
  d.catalogs = [
    { id: 'cat-st1', kind: 'study', name: 'ON101CL103 STUDY TMF', projectNo: 'ON101CL103', center: '', creator: '石磊', createDate: '2026-07-01', updateDate: '2026-07-01', size: '0KB', status: '未完成' },
  ];
  d.files = [
    { id: 'f-z1', name: '01 试验管理文件', kind: 'folder', projectNo: 'ON101CL103', center: '', uploader: '石磊', uploadDate: '2026-07-01', size: '0KB', status: 'archived', folderId: 'cat-st1' },
    { id: 'f-z2', name: '研究方案', kind: 'folder', projectNo: 'ON101CL103', center: '', uploader: '石磊', uploadDate: '2026-07-01', size: '0KB', status: 'archived', folderId: 'cat-st1', parentId: 'f-z1' },
    { id: 'f-z3', name: 'ON101CL103-研究方案-V3.0（2026-07-10）', kind: 'pdf', projectNo: 'ON101CL103', center: '', uploader: '石磊', uploadDate: '2026-07-10', size: '256.0KB', status: 'archived', folderId: 'cat-st1', parentId: 'f-z2' },
  ];
  d.submissions = []; d.submissionSchedule = [];
  localStorage.setItem('clinx-data-v2', JSON.stringify(d));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(700);

// ═══════════ 1. PM 走 UI 创建 SITE 目录（RJQM Excel → 33 文件夹） ═══════════
console.log('▶ 1. PM 创建 SITE 目录（RJQM）');
await navTo(page, 'SITE TMF');
assert(await clickText(page, '创建目录'), '打开 SITE 目录创建弹窗');
await sleep(600);
await setSelect(page, '[role="dialog"] select', 'ON101CL103');
await sleep(300);
await clickText(page, '研究中心（点击添加）', '[role="dialog"]');
await sleep(300);
await setSelect(page, '[role="dialog"] tbody tr:nth-child(1) select', '上海瑞金医院');
await sleep(300);
await clickText(page, '上传目录', '[role="dialog"]');
await sleep(300);
const excelInput = await page.$('[role="dialog"] input[type="file"][accept*=".xlsx"]');
await excelInput.uploadFile(RJQM);
await sleep(1500);
assert(await bodyHas(page, '将创建 一级 13 个 · 二级 20 个'), 'RJQM 解析：一级 13 · 二级 20');
await clickText(page, '确认创建', '[role="dialog"]');
await sleep(900);
let data = await readData(page);
const siteCat = (data.catalogs || []).find((c) => c.kind === 'site');
assert(!!siteCat && siteCat.name === 'ON101CL103-TMF-上海瑞金医院', `SITE 目录落库（实际 ${siteCat?.name}）`);
assert((data.files || []).filter((f) => f.kind === 'folder' && f.folderId === siteCat?.id).length === 33, '33 个文件夹落库');

/* 注入三级文件夹与归档文件：会议记录(L2) → 三级测试夹(L3) → 三级文件.pdf；伦理批件(L2) → 伦理批件扫描件.pdf */
await page.evaluate((catId) => {
  const d = JSON.parse(localStorage.getItem('clinx-data-v2') || '{}');
  const hy = d.files.find((f) => f.name === '会议记录' && f.folderId === catId);
  const ll = d.files.find((f) => f.name === '伦理批件' && f.folderId === catId);
  d.files.push(
    { id: 'f-l3', name: '三级测试夹', kind: 'folder', projectNo: 'ON101CL103', center: '上海瑞金医院', uploader: '石磊', uploadDate: '2026-08-01', size: '0KB', status: 'archived', folderId: catId, parentId: hy.id },
    { id: 'f-l3f', name: 'ON101CL103-三级文件-V1.0（2026-08-01）', kind: 'pdf', projectNo: 'ON101CL103', center: '上海瑞金医院', uploader: '石磊', uploadDate: '2026-08-01', size: '12.0KB', status: 'archived', folderId: catId, parentId: 'f-l3' },
    { id: 'f-llf', name: 'ON101CL103-伦理批件扫描件-V1.0（2026-08-02）', kind: 'pdf', projectNo: 'ON101CL103', center: '上海瑞金医院', uploader: '石磊', uploadDate: '2026-08-02', size: '88.0KB', status: 'archived', folderId: catId, parentId: ll.id },
  );
  localStorage.setItem('clinx-data-v2', JSON.stringify(d));
}, siteCat.id);
await page.reload({ waitUntil: 'networkidle0' });
await sleep(700);
console.log('  （三级测试夹/三级文件/伦理批件扫描件已注入）');

// ═══════════ 2. PM 端回归：SITE TMF 钻取 + STUDY TMF 钻取 ═══════════
console.log('▶ 2. PM 端回归');
await navTo(page, 'SITE TMF');
assert(await clickCatalogRow(page, 'ON101CL103-TMF-上海瑞金医院'), 'PM 进入 SITE 目录');
await sleep(400);
assert(await drillInto(page, '课题管理'), 'PM 下钻一级「课题管理」');
await sleep(400);
let names = await tableNames(page);
assert(names.includes('会议记录') && names.includes('沟通材料'), `PM 二级列表正确（实际 ${names.join('|')}）`);
assert(await drillInto(page, '会议记录'), 'PM 下钻二级「会议记录」');
await sleep(400);
names = await tableNames(page);
assert(names.includes('三级测试夹'), 'PM 三级列表显示「三级测试夹」');
assert(await breadcrumbTo(page, '课题管理'), 'PM 面包屑回跳「课题管理」');
await sleep(400);
names = await tableNames(page);
assert(names.includes('会议记录') && !names.includes('三级测试夹'), 'PM 回跳后回到二级列表');
await shot(page, 231, 'pm-site-drill-regression');

await navTo(page, 'STUDY TMF');
assert(await clickCatalogRow(page, 'ON101CL103 STUDY TMF'), 'PM 进入 STUDY 目录');
await sleep(400);
assert(await drillInto(page, '01 试验管理文件'), 'PM STUDY 下钻一级');
await sleep(400);
assert(await drillInto(page, '研究方案'), 'PM STUDY 下钻二级');
await sleep(400);
names = await tableNames(page);
assert(names.some((n) => n.includes('研究方案-V3.0')), `PM STUDY 文件可见（实际 ${names.join('|')}）`);
await shot(page, 232, 'pm-study-drill-regression');

// ═══════════ 3. 执行端（zhanglan）：SITE TMF 逐级下钻 ═══════════
console.log('▶ 3. 执行端逐级下钻');
const page2 = await browser.newPage();
page2.on('pageerror', (e) => console.log('  [pageerror2]', e.message));
await login(page2, 'zhanglan', '123456');
await navTo(page2, 'SITE TMF');
assert(await clickCatalogRow(page2, 'ON101CL103-TMF-上海瑞金医院'), 'CRA 进入中心 SITE 目录');
await sleep(400);
names = await tableNames(page2);
assert(names.includes('课题管理') && names.includes('课题团队') && names.length === 13, `CRA 一级列表 13 个一级文件夹（实际 ${names.length}）`);
assert(!names.includes('会议记录'), '一级列表不含二级文件夹（!parentId 口径）');
await drillCentered(page2, 'CRA 一级列表');
await shot(page2, 233, 'cra-site-level1');

assert(await drillInto(page2, '课题管理'), 'CRA 下钻「课题管理」（原 bug 点）');
await sleep(400);
names = await tableNames(page2);
assert(names.includes('会议记录') && names.includes('沟通材料'), `CRA 进入二级（实际 ${names.join('|')}）`);
let crumb = await crumbText(page2);
assert(crumb.includes('SITE TMF') && crumb.includes('ON101CL103-TMF-上海瑞金医院') && crumb.includes('课题管理'), `面包屑三级链路正确（实际 ${crumb}）`);
await shot(page2, 234, 'cra-site-level2');

assert(await drillInto(page2, '会议记录'), 'CRA 下钻「会议记录」');
await sleep(400);
assert(await drillInto(page2, '三级测试夹'), 'CRA 下钻三级「三级测试夹」');
await sleep(400);
names = await tableNames(page2);
assert(names.some((n) => n.includes('三级文件')), `CRA 三级文件夹内文件可见（实际 ${names.join('|')}）`);
crumb = await crumbText(page2);
assert(crumb.includes('会议记录') && crumb.includes('三级测试夹'), '面包屑含三级路径');
await shot(page2, 235, 'cra-site-level3-file');

/* 面包屑逐级回跳 */
assert(await breadcrumbTo(page2, '课题管理'), 'CRA 面包屑回跳「课题管理」');
await sleep(400);
names = await tableNames(page2);
assert(names.includes('会议记录') && !names.includes('三级测试夹'), '回跳后回到二级列表');
assert(await breadcrumbTo(page2, 'ON101CL103-TMF-上海瑞金医院'), 'CRA 面包屑回跳目录顶层');
await sleep(400);
names = await tableNames(page2);
assert(names.length === 13 && names.includes('课题管理'), '回跳后回到一级列表');
await shot(page2, 236, 'cra-site-breadcrumb-back');

/* 文件下载 */
assert(await drillInto(page2, '研究中心'), 'CRA 下钻「研究中心」');
await sleep(400);
assert(await drillInto(page2, '伦理批件'), 'CRA 下钻「伦理批件」');
await sleep(400);
/* 文件下载（点击钻取表操作列的「下载」链接——不能取页面第一个 tbody，管理表在前） */
assert(await page2.evaluate(() => {
  const tb = [...document.querySelectorAll('table')].find((t) => t.querySelector('thead')?.textContent.includes('名称'));
  const btn = tb && [...tb.querySelectorAll('tbody button')].find((b) => b.textContent.trim() === '下载');
  if (!btn) return false;
  btn.click();
  return true;
}), 'CRA 点击文件「下载」');
await sleep(500);
assert(await page2.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')].some((t) => t.textContent.includes('已开始下载'))), '下载 toast 出现');
await shot(page2, 237, 'cra-site-file-download');

await browser.close();
console.log(`\n═══ R36 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
