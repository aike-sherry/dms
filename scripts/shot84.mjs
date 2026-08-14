// R31 验证：上传递交文件弹窗新增「递交主题」必填录入（双 tab）+「目标递交时限」日历控件（复用 teal 日历面板）
// DEMO_MODE=false，PM shilei；截图 189 起
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:5199';
const SHOTS = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/shots/';
const LOCAL_FILE = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/tmp/R31方案最终版.pdf';
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

async function login(u, p, fresh = false) {
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
  }, { u, p });
  await page.waitForFunction(() => !!sessionStorage.getItem('clinx-auth'), { timeout: 8000 });
  await sleep(300);
}
async function readData() {
  return page.evaluate(() => JSON.parse(localStorage.getItem('clinx-data-v2') || '{}'));
}
async function navTo(name) {
  await page.evaluate((name) => {
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === name)?.click();
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
/* 按钮文字含计数后缀（如「确认上传（1）」）时用前缀匹配 */
async function clickButtonStartsWith(text, scope = 'body') {
  return page.evaluate(({ text, scope }) => {
    const root = scope === 'body' ? document.body : document.querySelector(scope);
    if (!root) return false;
    const btn = [...root.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
    if (btn) { btn.click(); return true; }
    return false;
  }, { text, scope });
}
async function setInput(ph, value, scope = '[role="dialog"]') {
  await page.evaluate(({ ph, value, scope }) => {
    const root = document.querySelector(scope);
    const el = [...root.querySelectorAll('input')].find((i) => (i.placeholder || '').includes(ph));
    if (!el) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { ph, value, scope });
}
const getInput = (ph, scope = '[role="dialog"]') =>
  page.evaluate(({ ph, scope }) => {
    const root = document.querySelector(scope);
    const el = [...root.querySelectorAll('input')].find((i) => (i.placeholder || '').includes(ph));
    return el ? el.value : null;
  }, { ph, scope });
/* 日历面板：按 data-day 精确点选目标日期（避免 outside 补位日歧义） */
async function pickDate(y, m, d) {
  const candidates = [`${y}/${m}/${d}`, `${m}/${d}/${y}`, `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`];
  return page.evaluate((candidates) => {
    const pop = document.querySelector('[data-radix-popper-content-wrapper]');
    if (!pop) return false;
    const btn = [...pop.querySelectorAll('td button')].find((b) => candidates.includes(b.getAttribute('data-day') || ''));
    if (btn) { btn.click(); return true; }
    return false;
  }, candidates);
}
/* 翻月：面板内仅有的两个纯图标按钮即 上一月/下一月（无文字） */
async function clickNextMonth() {
  return page.evaluate(() => {
    const pop = document.querySelector('[data-radix-popper-content-wrapper]');
    if (!pop) return false;
    const iconOnly = [...pop.querySelectorAll('button')].filter((b) => b.textContent.trim() === '');
    const next = iconOnly[iconOnly.length - 1];
    if (next) { next.click(); return true; }
    return false;
  });
}
const popCaption = () =>
  page.evaluate(() => {
    const pop = document.querySelector('[data-radix-popper-content-wrapper]');
    if (!pop) return null;
    /* 自定义 classNames 覆盖了 rdp-* 类名，取日历根节点首行文本即月份标题 */
    const root = pop.querySelector('[data-slot="calendar"]');
    return root ? (root.innerText.split('\n')[0] || '').trim() : null;
  });

console.log('▶ 0. 注入 STUDY 目录+归档文件（供 TMF tab 测试）');
await login('shilei', '123456', true);
await page.evaluate(() => {
  const seed = {
    files: [
      { id: 'f-901', name: '研究方案V3.pdf', kind: 'pdf', projectNo: 'ON101CLCT06', center: '', uploader: '石磊', uploadDate: '2026-08-10', size: '12KB', status: 'archived', folderId: 'cat-st9' },
      { id: 'f-902', name: '伦理批件扫描.pdf', kind: 'pdf', projectNo: 'ON101CLCT06', center: '', uploader: '石磊', uploadDate: '2026-08-11', size: '8KB', status: 'archived', folderId: 'cat-st9' },
    ],
    catalogs: [
      { id: 'cat-st9', kind: 'study', name: 'ON101CLCT06 STUDY TMF', projectNo: 'ON101CLCT06', creator: '石磊', createDate: '2026-08-01', updateDate: '2026-08-01', size: '0KB', status: '未完成' },
    ],
    submissions: [],
    submissionSchedule: [],
  };
  localStorage.setItem('clinx-data-v2', JSON.stringify(seed));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(500);
await navTo('SUBMISSION');

// ── 1. 本地上传：主题默认带入 + 必填阻止 + 日历选 2026-09-30 ──
console.log('▶ 1. 本地上传 tab');
assert(await clickText('上传'), '打开「上传递交文件」弹窗');
await sleep(600);
assert((await getInput('请输入递交主题')) !== null, '弹窗含「递交主题」输入框');
const hasDeadlineField = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  return !!dlg && [...dlg.querySelectorAll('button')].some((b) => b.textContent.includes('选择日期'));
});
assert(hasDeadlineField, '弹窗含「目标递交时限」日历字段');
/* 选文件 → 主题默认带入去扩展名 */
await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  [...dlg.querySelectorAll('button')].find((b) => b.textContent.includes('点击选择本地文件'))?.click();
});
await sleep(200);
const fileInput = await page.$('[role="dialog"] input[type="file"]');
await fileInput.uploadFile(LOCAL_FILE);
await sleep(600);
assert((await getInput('请输入递交主题')) === 'R31方案最终版', '选文件后主题默认带入（去扩展名）');
/* 清空主题 → 确认上传被阻止 */
await setInput('请输入递交主题', '');
await sleep(200);
assert(await clickButtonStartsWith('确认上传', '[role="dialog"]'), '点击确认上传（主题空）');
await sleep(500);
const toastShown = await page.evaluate(() => document.body.innerText.includes('请填写递交主题'));
assert(toastShown, '主题留空时 toast 阻止提示');
const dlgStillOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
assert(dlgStillOpen, '弹窗未关闭');
assert(((await readData()).submissions || []).length === 0, '未落库任何递交');
/* 自定义主题 + 日历翻月选 9/30 */
await setInput('请输入递交主题', 'R31 方案递交（自定义主题）');
await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  [...dlg.querySelectorAll('button')].find((b) => b.textContent.includes('选择日期'))?.click();
});
await sleep(600);
const cap0 = await popCaption();
assert(cap0 !== null && cap0 !== '', `日历弹出（当前月「${cap0}」）`);
assert(await clickNextMonth(), '点击翻月（下一月）');
await sleep(500);
const cap1 = await popCaption();
assert(cap1 && cap1 !== cap0, `翻月成功（「${cap0}」→「${cap1}」）`);
await page.screenshot({ path: SHOTS + '189-upload-dialog-calendar.png' });
console.log('  📸 189-upload-dialog-calendar.png（弹窗含主题+日历控件展开态）');
assert(await pickDate(2026, 9, 30), '选择 2026-09-30（data-day 精确匹配）');
await sleep(400);
const deadlineVal = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  return [...dlg.querySelectorAll('button')].find((b) => /\d{4}-\d{2}-\d{2}/.test(b.textContent))?.textContent.trim() || null;
});
assert(deadlineVal === '2026-09-30', `时限字段显示 2026-09-30（实际 ${deadlineVal}）`);
assert(await clickButtonStartsWith('确认上传', '[role="dialog"]'), '确认上传');
await sleep(700);
let data = await readData();
let sub = (data.submissions || [])[0];
assert(sub && sub.topic === 'R31 方案递交（自定义主题）', `落库主题=自定义主题（实际 ${sub?.topic}）`);
assert(sub && sub.deadline === '2026-09-30', '落库 deadline=2026-09-30');
assert(sub && sub.fileName === 'R31方案最终版.pdf', '文件名保留');

// ── 2. 发布 → 矩阵行主题/时限正确 ──
console.log('▶ 2. 发布 → 矩阵同步');
await page.evaluate(() => {
  const tables = [...document.querySelectorAll('table')];
  const files = tables[tables.length - 1];
  const row = [...files.querySelectorAll('tbody tr')].find((tr) => tr.textContent.includes('R31 方案递交'));
  if (!row) return;
  [...row.querySelectorAll('button')].find((b) => b.textContent.trim() === '发布')?.click();
});
await sleep(800);
const matrix = await page.evaluate(() => {
  const row = [...document.querySelectorAll('tbody tr')].find((tr) => tr.textContent.includes('R31 方案递交'));
  return row ? [...row.querySelectorAll('td')].map((td) => td.textContent.trim()) : null;
});
assert(matrix && matrix[0] === 'R31 方案递交（自定义主题）', '矩阵主题列=录入主题');
assert(matrix && matrix[2] === '2026-09-30', '矩阵时限列=2026-09-30');
assert(matrix && matrix.slice(3).every((c) => c === '待递交'), '各中心初始待递交');
await page.screenshot({ path: SHOTS + '190-matrix-after-publish.png' });
console.log('  📸 190-matrix-after-publish.png（发布后矩阵）');

// ── 3. 从 STUDY TMF 选择 tab：主题同样可录入 ──
console.log('▶ 3. STUDY TMF tab');
assert(await clickText('上传'), '再次打开上传弹窗');
await sleep(600);
assert(await clickText('从 STUDY TMF 选择', '[role="dialog"]'), '切到 TMF tab');
await sleep(400);
assert(await clickText('ON101CLCT06 STUDY TMF', '[role="dialog"]'), '选择目录');
await sleep(400);
await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const label = [...dlg.querySelectorAll('label')].find((l) => l.textContent.includes('研究方案V3.pdf'));
  label?.querySelector('input[type=checkbox]')?.click();
});
await sleep(400);
assert((await getInput('请输入递交主题')) === '研究方案V3', '勾选文件后主题默认带入');
await setInput('请输入递交主题', 'R31 TMF引入递交');
await sleep(200);
assert(await clickButtonStartsWith('确认引入', '[role="dialog"]'), '确认引入（时限留空）');
await sleep(700);
data = await readData();
sub = (data.submissions || []).find((s) => s.topic === 'R31 TMF引入递交');
assert(sub && sub.fileName === '研究方案V3.pdf', 'TMF 引入落库主题=录入值');
assert(sub && !sub.deadline, '时限留空（矩阵将显示 —）');

// ── 4. 新建递交弹窗：目标时限日历控件回归 ──
console.log('▶ 4. 新建递交弹窗日历回归');
assert(await clickText('新建'), '打开「新建递交」弹窗');
await sleep(600);
await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  [...dlg.querySelectorAll('button')].find((b) => b.textContent.trim() === '新建')?.click();
});
await sleep(400);
const noTextDeadline = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  return ![...dlg.querySelectorAll('input')].some((i) => (i.placeholder || '') === 'YYYY-MM-DD');
});
assert(noTextDeadline, '新建递交不再使用文本式时限输入');
await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  [...dlg.querySelectorAll('button')].find((b) => b.textContent.includes('选择日期'))?.click();
});
await sleep(600);
assert((await popCaption()) !== null, '新建递交行内日历弹出');
assert(await pickDate(2026, 8, 25), '选择 2026-08-25（当月，data-day 精确匹配）');
await sleep(400);
const cellVal = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  return [...dlg.querySelectorAll('button')].find((b) => /\d{4}-\d{2}-\d{2}/.test(b.textContent))?.textContent.trim() || null;
});
assert(cellVal === '2026-08-25', `新建递交时限=2026-08-25（实际 ${cellVal}）`);
await clickText('取消', '[role="dialog"]');
await sleep(400);

await browser.close();
console.log(`\n═══ R31 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
