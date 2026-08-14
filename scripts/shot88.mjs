// R35 验证：执行端 SUBMISSION 数据链路修复
// ① PM 发布的递交执行端可见（按 CRA 分配项目过滤）② 本中心单元格点击日历录入日期即存 ③ 跨标签页同步 ④ PM 端只读显示
// DEMO_MODE=false 空白环境；截图 225 起，存工作区根 shots/
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const BASE = 'http://localhost:5199';
const SHOTS = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/shots/';
const TMP = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/clinx-trials-dms/tmp-upload/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const assert = (cond, name) => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ FAIL: ${name}`); }
};

fs.mkdirSync(TMP, { recursive: true });
fs.writeFileSync(TMP + '伦理批件.pdf', '%PDF-1.4 伦理批件');

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
async function pickDate(pg, y, m, d) {
  const candidates = [`${y}/${m}/${d}`, `${m}/${d}/${y}`, `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`];
  return pg.evaluate((candidates) => {
    const pop = document.querySelector('[data-radix-popper-content-wrapper]');
    if (!pop) return false;
    const btn = [...pop.querySelectorAll('td button')].find((b) => candidates.includes(b.getAttribute('data-day') || ''));
    if (btn) { btn.click(); return true; }
    return false;
  }, candidates);
}
async function clickNextMonth(pg) {
  return pg.evaluate(() => {
    const pop = document.querySelector('[data-radix-popper-content-wrapper]');
    if (!pop) return false;
    const iconOnly = [...pop.querySelectorAll('button')].filter((b) => b.textContent.trim() === '');
    const next = iconOnly[iconOnly.length - 1];
    if (next) { next.click(); return true; }
    return false;
  });
}
async function pickDateNav(pg, y, m, d) {
  for (let i = 0; i < 6; i++) {
    if (await pickDate(pg, y, m, d)) return true;
    await clickNextMonth(pg);
    await sleep(250);
  }
  return false;
}
const shot = async (pg, num, name) => {
  await pg.screenshot({ path: `${SHOTS}${num}-${name}.png` });
  console.log(`  📸 ${num}-${name}.png`);
};

/* PM 新建递交一条（主题/项目/时限日历/1 文件 → 提交即发布） */
async function pmCreateSubmission(pg, topic, projectNo, deadline) {
  await clickText(pg, '新建');
  await sleep(600);
  await pg.evaluate(() => {
    const row = document.querySelector('[role="dialog"] tbody tr');
    [...row.querySelectorAll('button')].find((b) => b.textContent.includes('本地上传'))?.click();
  });
  await sleep(300);
  const fi = await pg.$('[role="dialog"] input[type="file"][multiple]');
  await fi.uploadFile(TMP + '伦理批件.pdf');
  await sleep(400);
  await pg.evaluate((topic) => {
    const input = document.querySelector('[role="dialog"] tbody tr input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, topic);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, topic);
  await setSelect(pg, '[role="dialog"] tbody tr select', projectNo);
  await sleep(200);
  if (deadline) {
    const [y, m, d] = deadline.split('-').map(Number);
    await pg.evaluate(() => {
      [...document.querySelectorAll('[role="dialog"] tbody tr')[0].querySelectorAll('button')].find((b) => b.textContent.includes('选择日期'))?.click();
    });
    await sleep(400);
    await pickDateNav(pg, y, m, d);
    await sleep(300);
  }
  await pg.evaluate(() => {
    [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === '提交')?.click();
  });
  await sleep(900);
}

// ═══════════ 0. 空白环境 + 注册表（张兰→上海瑞金医院/ON101CL103，李华→北京协和医院/ON101CL103）+ 双 STUDY 目录 ═══════════
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
    { id: 'cat-st2', kind: 'study', name: 'ON201CL01 STUDY TMF', projectNo: 'ON201CL01', center: '', creator: '石磊', createDate: '2026-07-01', updateDate: '2026-07-01', size: '0KB', status: '未完成' },
  ];
  d.files = []; d.submissions = []; d.submissionSchedule = [];
  localStorage.setItem('clinx-data-v2', JSON.stringify(d));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(700);

// ═══════════ 1. PM 新建两条递交并发布（A=ON101CL103 CRA 可见；B=ON201CL01 无 CRA 中心应被过滤） ═══════════
console.log('▶ 1. PM 创建并发布');
await navTo(page, 'SUBMISSION');
await pmCreateSubmission(page, '伦理批件递交', 'ON101CL103', '2026-09-30');
await pmCreateSubmission(page, '其他项目递交', 'ON201CL01', null);
let data = await readData(page);
assert((data.submissions || []).length === 2 && data.submissions.every((s) => s.published), `PM 落库 2 条已发布递交（实际 ${(data.submissions || []).length}）`);
assert((data.submissionSchedule || []).length === 2, `矩阵 2 行（实际 ${(data.submissionSchedule || []).length}）`);
assert(await bodyHas(page, '伦理批件递交') && await bodyHas(page, '其他项目递交'), 'PM 端矩阵显示两条递交');
assert(await page.evaluate(() => {
  const tb = document.querySelector('table');
  return tb && ![...tb.querySelectorAll('tbody td button')].length;
}), 'PM 端矩阵单元格只读（无日期编辑按钮）');
await shot(page, 225, 'pm-matrix-two-submissions');

// ═══════════ 2. 新标签页登录 zhanglan：按分配过滤可见性 ═══════════
console.log('▶ 2. 执行端可见性与分配过滤');
const page2 = await browser.newPage();
page2.on('pageerror', (e) => console.log('  [pageerror2]', e.message));
await login(page2, 'zhanglan', '123456');
await navTo(page2, 'SUBMISSION');
assert(await bodyHas(page2, '伦理批件递交'), '执行端矩阵显示 CRA 项目递交（伦理批件递交）');
assert(!(await bodyHas(page2, '其他项目递交')), '执行端矩阵过滤无分配项目递交（其他项目递交不可见）');
const listInfo = await page2.evaluate(() => {
  const cards = [...document.querySelectorAll('h2')];
  const fileCard = cards.find((h) => h.textContent.trim() === '递交文件')?.closest('div.rounded-2xl');
  const text = fileCard?.innerText ?? '';
  return { hasA: text.includes('伦理批件递交'), hasB: text.includes('其他项目递交') };
});
assert(listInfo.hasA && !listInfo.hasB, `递交文件列表同口径过滤（A 可见 ${listInfo.hasA} / B 不可见 ${!listInfo.hasB}）`);
const sideUpper = await page2.evaluate(() =>
  [...document.querySelectorAll('aside button')].filter((b) => /[A-Z]/.test(b.textContent)).every((b) => b.textContent.trim() === b.textContent.trim().toUpperCase()));
assert(sideUpper, '执行端导航模块英文保持大写');
/* 矩阵单元格权限：瑞金（张兰）可点、协和（李华）只读 */
const cellInfo = await page2.evaluate(() => {
  const mtx = [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === '递交概况')?.closest('div.rounded-2xl')?.querySelector('table');
  if (!mtx) return null;
  const row = mtx.querySelector('tbody tr');
  const tds = [...row.querySelectorAll('td')];
  const heads = [...mtx.querySelectorAll('thead tr')][0];
  return {
    header: [...heads.querySelectorAll('th')].map((t) => t.textContent.trim()).filter(Boolean),
    tdCount: tds.length,
    xieheHasBtn: !!tds[3]?.querySelector('button'),
    ruijinBtnText: tds[4]?.querySelector('button')?.textContent.trim() ?? null,
    allCentered: [...mtx.querySelectorAll('th, td')].filter((el) => el.getClientRects().length).every((el) => getComputedStyle(el).textAlign === 'center'),
  };
});
assert(cellInfo && cellInfo.header.join('|') === '北京协和医院|上海瑞金医院', `矩阵中心列=注册表两中心（实际 ${cellInfo?.header.join('|')}）`);
assert(cellInfo && !cellInfo.xieheHasBtn, '协和（他人中心）单元格无按钮只读');
assert(cellInfo && cellInfo.ruijinBtnText === '待递交', `瑞金（本中心）单元格为可点「待递交」（实际 ${cellInfo?.ruijinBtnText}）`);
assert(cellInfo && cellInfo.allCentered, '执行端矩阵 th/td 全部居中（规范）');
await shot(page2, 226, 'cra-filtered-view');

// ═══════════ 3. 本中心单元格点击 → 日历选 2026-08-20 → 即存 ═══════════
console.log('▶ 3. 单元格日历录入');
await page2.evaluate(() => {
  const mtx = [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === '递交概况')?.closest('div.rounded-2xl')?.querySelector('table');
  [...mtx.querySelectorAll('tbody tr')[0].querySelectorAll('td')][4]?.querySelector('button')?.click();
});
await sleep(500);
assert(await page2.evaluate(() => !!document.querySelector('[data-radix-popper-content-wrapper]')), '点击待递交弹出日历面板');
await shot(page2, 227, 'cra-cell-calendar-open');
assert(await pickDateNav(page2, 2026, 8, 20), '日历选 2026-08-20');
await sleep(700);
assert(await page2.evaluate(() => {
  const mtx = [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === '递交概况')?.closest('div.rounded-2xl')?.querySelector('table');
  const tds = [...mtx.querySelectorAll('tbody tr')[0].querySelectorAll('td')];
  return tds[4]?.querySelector('button')?.textContent.includes('2026-08-20');
}), '保存后单元格显示 2026-08-20');
assert(await page2.evaluate(() => [...document.querySelectorAll('[data-sonner-toast]')].some((t) => t.textContent.includes('递交日期已更新'))), '保存 toast 提示');
data = await readData(page2);
const rowA = (data.submissionSchedule || []).find((r) => r.topic === '伦理批件递交');
assert(rowA?.dates?.['上海瑞金医院'] === '2026-08-20', `落库 dates[上海瑞金医院]=2026-08-20（实际 ${rowA?.dates?.['上海瑞金医院']}）`);
await shot(page2, 228, 'cra-cell-date-saved');

// ═══════════ 4. 跨标签页同步：PM 标签页再发一条 → CRA 标签页不刷新自动出现 ═══════════
console.log('▶ 4. 跨标签页同步');
await page.bringToFront();
await sleep(300);
await pmCreateSubmission(page, '跨标签同步递交', 'ON101CL103', null);
await page2.bringToFront();
await sleep(1200);
const synced = await page2.evaluate(() => document.body.innerText.includes('跨标签同步递交'));
assert(synced, 'CRA 标签页不刷新自动同步新递交（storage 水合）');
const syncedList = await page2.evaluate(() => {
  const fileCard = [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === '递交文件')?.closest('div.rounded-2xl');
  return fileCard?.innerText.includes('跨标签同步递交');
});
assert(syncedList, 'CRA 递交文件列表同步出现新递交');
await shot(page2, 229, 'cra-cross-tab-synced');

// ═══════════ 5. 回到 PM：刷新后矩阵瑞金列只读显示 2026-08-20 ═══════════
console.log('▶ 5. PM 端同步只读');
await page.bringToFront();
await page.reload({ waitUntil: 'networkidle0' });
await sleep(700);
await navTo(page, 'SUBMISSION');
const pmCell = await page.evaluate(() => {
  const mtx = [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === '递交概况')?.closest('div.rounded-2xl')?.querySelector('table');
  if (!mtx) return null;
  const row = [...mtx.querySelectorAll('tbody tr')].find((r) => r.innerText.includes('伦理批件递交'));
  if (!row) return null;
  const tds = [...row.querySelectorAll('td')];
  return { text: tds[4]?.innerText.trim(), hasBtn: !!tds[4]?.querySelector('button'), xiehe: tds[3]?.innerText.trim() };
});
assert(pmCell && pmCell.text === '2026-08-20' && !pmCell.hasBtn, `PM 端瑞金单元格只读显示 2026-08-20（实际 ${pmCell?.text}）`);
assert(pmCell && pmCell.xiehe === '待递交', `PM 端协和单元格仍「待递交」（实际 ${pmCell?.xiehe}）`);
await shot(page, 230, 'pm-matrix-date-readonly');

await browser.close();
console.log(`\n═══ R35 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
