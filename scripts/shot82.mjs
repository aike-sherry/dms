// R29 验证：PM 发布递交 → 递交概况矩阵同步生成行；CRA 录入日期 → PM 矩阵同步；删除联动移除；老数据自动补全
// DEMO_MODE=false，PM shilei / CRA zhanglan
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:5199';
const SHOTS = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/shots/';
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

async function login(username, password, fresh = false) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
  if (fresh) await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  await sleep(300);
  await page.evaluate(({ u, p }) => {
    const inputs = [...document.querySelectorAll('input')];
    const set = (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(inputs[0], u); set(inputs[1], p);
    [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s/g, '') === '登录')?.click();
  }, { u: username, p: password });
  await page.waitForFunction(() => !!sessionStorage.getItem('clinx-auth'), { timeout: 8000 });
  await sleep(300);
}
async function logout() {
  /* 只清登录态，保留 clinx-data-v2——跨角色同步依赖同库持久化 */
  await page.evaluate(() => sessionStorage.removeItem('clinx-auth'));
}
async function readData() {
  return page.evaluate(() => JSON.parse(localStorage.getItem('clinx-data-v2') || '{}'));
}
async function setInputByHandle(ph, value) {
  await page.evaluate(({ ph, value }) => {
    const el = [...document.querySelectorAll('input,textarea')].find((i) => (i.placeholder || '').includes(ph));
    if (!el) return;
    const proto = el.constructor === HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { ph, value });
}
async function clickText(text, scope = 'body') {
  return page.evaluate(({ text, scope }) => {
    const root = scope === 'body' ? document.body : document.querySelector(scope);
    if (!root) return false;
    const els = [...root.querySelectorAll('button, a, [role="button"], [role="tab"], span, div, td, th')];
    let el = els.find((e) => e.children.length === 0 && e.textContent.trim() === text);
    if (!el) el = els.find((e) => (e.tagName === 'BUTTON' || e.getAttribute('role') === 'button') && e.textContent.trim() === text);
    if (el) { el.click(); return true; }
    return false;
  }, { text, scope });
}
async function navTo(name) {
  /* 应用为内部状态导航：点击顶栏按钮并设置 hash，hash-only goto 不会触发切换 */
  await page.evaluate((name) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === name);
    btn?.click();
  }, name);
  await sleep(700);
}
const today = await page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
console.log('  今天 =', today);

// ── 1. PM 新建递交（含目标时限），未发布前矩阵为空 ──
console.log('▶ 1. PM 新建递交（含目标时限）');
await login('shilei', '123456', true);
await navTo('SUBMISSION');
assert(await clickText('新建'), '点击页面「新建」打开对话框');
await sleep(600);
/* 对话框内点「新建」加第 3 行（n1/n2 预填行非 isNew，纯文本；仅新行有 input） */
await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return;
  [...dlg.querySelectorAll('button')].find((b) => b.textContent.trim() === '新建')?.click();
});
await sleep(400);
await setInputByHandle('递交主题', 'R29方案递交');
await setInputByHandle('项目编号', 'ON101CLCT06');
await setInputByHandle('YYYY-MM-DD', '2026-09-30');
assert(await clickText('提交', '[role="dialog"]'), '对话框「提交」');
await sleep(800);
let data = await readData();
assert(data.submissions?.length === 3, `submissions 3 条（实际 ${data.submissions?.length}）`);
assert((data.submissionSchedule || []).length === 0, '未发布前概况矩阵为空');
const sub = data.submissions.find((s) => s.topic === 'R29方案递交');
assert(sub && sub.deadline === '2026-09-30' && !sub.published, '新递交带 deadline 且未发布');

// ── 2. 发布 → 矩阵行生成 ──
console.log('▶ 2. 发布 → 矩阵行生成');
await page.evaluate(() => {
  const tables = [...document.querySelectorAll('table')];
  const files = tables[tables.length - 1];
  const row = [...files.querySelectorAll('tbody tr')].find((tr) => tr.textContent.includes('R29方案递交'));
  [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === '发布')?.click();
});
await sleep(800);
data = await readData();
let rows = data.submissionSchedule || [];
assert(rows.length === 1 && rows[0].id === sub.id, '发布后矩阵行生成且 id === 递交 id');
assert(rows[0]?.publishDate === today, `发布日期 = 今天（${rows[0]?.publishDate}）`);
assert(rows[0]?.deadline === '2026-09-30', '目标时限 = 2026-09-30');
assert(rows[0] && Object.keys(rows[0].dates).length === 0, 'dates 初始为空');
/* 矩阵行 td 序列：[主题, 发布日期, 目标时限, 瑞金, 中山, 华山, 南山] */
let matrix = await page.evaluate(() => {
  const row = [...document.querySelectorAll('tbody tr')].find((tr) => tr.textContent.includes('R29方案递交'));
  return row ? [...row.querySelectorAll('td')].map((td) => td.textContent.trim()) : null;
});
assert(matrix && matrix[1] === today && matrix[2] === '2026-09-30', `矩阵行显示发布日期+时限（实际 ${matrix?.slice(0, 3)}）`);
assert(matrix && matrix.slice(3).length === 4 && matrix.slice(3).every((c) => c === '待递交'), '各中心初始全部「待递交」');
await page.screenshot({ path: SHOTS + '179-pm-publish-matrix-row.png' });
console.log('  📸 179-pm-publish-matrix-row.png');

// ── 3. CRA 录入日期 → 保存 ──
console.log('▶ 3. CRA zhanglan 录入瑞金医院日期');
await logout();
await login('zhanglan', '123456');
await navTo('SUBMISSION');
assert(await clickText('更新'), 'CRA 点击「更新」进入编辑');
await sleep(500);
const cellCount = await page.evaluate(() =>
  [...document.querySelectorAll('tbody tr button')].filter((b) => b.textContent.trim() === '选择日期').length);
assert(cellCount === 1, `仅本中心（瑞金医院）1 个可编辑日期单元格（实际 ${cellCount}）`);
await page.evaluate(() => {
  [...document.querySelectorAll('tbody tr button')].find((b) => b.textContent.trim() === '选择日期')?.click();
});
await sleep(600);
const dayClicked = await page.evaluate(() => {
  const pop = document.querySelector('[data-radix-popper-content-wrapper]') || document.body;
  const btn = [...pop.querySelectorAll('button')].find((b) => b.textContent.trim() === '15');
  if (btn) { btn.click(); return true; }
  return false;
});
assert(dayClicked, '日历选择 15 日');
await sleep(400);
await page.screenshot({ path: SHOTS + '180-cra-date-entry.png' });
console.log('  📸 180-cra-date-entry.png（保存前编辑态）');
assert(await clickText('保存'), 'CRA 点击「保存」');
await sleep(600);
data = await readData();
assert(data.submissionSchedule?.[0]?.dates?.['瑞金医院'] === '2026-08-15', `store 瑞金医院 = 2026-08-15（实际 ${data.submissionSchedule?.[0]?.dates?.['瑞金医院']}）`);
assert(!data.submissionSchedule?.[0]?.dates?.['中山医院'], '中山医院仍空');

// ── 4. PM 端同步可见 ──
console.log('▶ 4. PM 端矩阵同步显示');
await logout();
await login('shilei', '123456');
await navTo('SUBMISSION');
matrix = await page.evaluate(() => {
  const row = [...document.querySelectorAll('tbody tr')].find((tr) => tr.textContent.includes('R29方案递交'));
  return row ? [...row.querySelectorAll('td')].map((td) => td.textContent.trim()) : null;
});
assert(matrix && matrix[3] === '2026-08-15', `PM 矩阵瑞金医院 = 2026-08-15（实际 ${matrix?.[3]}）`);
assert(matrix && matrix[4] === '待递交', 'PM 矩阵中山医院仍「待递交」');
await page.screenshot({ path: SHOTS + '181-pm-matrix-synced.png' });
console.log('  📸 181-pm-matrix-synced.png');

// ── 5. 老数据（已发布无概况行）自动补全 ──
console.log('▶ 5. 老数据自动补全');
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('clinx-data-v2'));
  raw.submissions.push({ id: 's-900', topic: '老数据方案递交', fileName: '老数据方案.pdf', kind: 'pdf', projectNo: 'ON101CLCT06', uploadDate: '2026-08-01', size: '1KB', published: true });
  localStorage.setItem('clinx-data-v2', JSON.stringify(raw));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(600);
data = await readData();
rows = data.submissionSchedule || [];
assert(rows.length === 2, `加载后矩阵 2 行（实际 ${rows.length}）`);
assert(rows.some((r) => r.id === 's-900' && r.publishDate === '2026-08-01' && r.deadline === ''), '老数据派生行：publishDate 回退 uploadDate、无 deadline');
await page.reload({ waitUntil: 'networkidle0' });
await sleep(600);
data = await readData();
assert((data.submissionSchedule || []).length === 2, '再次加载不重复补行（幂等）');
/* reload 后 hash 仍为 #/submission，挂载即落在递交页 */
const legacyRow = await page.evaluate(() => {
  const row = [...document.querySelectorAll('tbody tr')].find((tr) => tr.textContent.includes('老数据方案递交'));
  return row ? [...row.querySelectorAll('td')].map((td) => td.textContent.trim()) : null;
});
assert(legacyRow && legacyRow[1] === '2026-08-01' && legacyRow[2] === '—', `老数据矩阵行：发布日期 2026-08-01、时限 —（实际 ${legacyRow?.slice(0, 3)}）`);
assert(legacyRow && legacyRow.slice(3).every((c) => c === '待递交'), '老数据各中心「待递交」');
await page.screenshot({ path: SHOTS + '182-legacy-backfill.png' });
console.log('  📸 182-legacy-backfill.png');

// ── 6. 删除递交 → 概况行联动移除（页面「删除」= removeLast，s-900 为最后一条） ──
console.log('▶ 6. 删除递交 → 概况行联动移除');
assert(await clickText('删除'), '点击页面「删除」（移除最后一条 = s-900）');
await sleep(600);
data = await readData();
assert(!data.submissions?.some((s) => s.id === 's-900'), '递交文件已删除');
assert(!(data.submissionSchedule || []).some((r) => r.id === 's-900'), '概况行联动移除');
const gone = await page.evaluate(() => ![...document.querySelectorAll('tbody tr')].some((tr) => tr.textContent.includes('老数据方案递交')));
assert(gone, '矩阵 DOM 中老数据行消失');

await browser.close();
console.log(`\n═══ R29 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
