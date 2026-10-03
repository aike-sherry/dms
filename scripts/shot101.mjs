// C3 观察期：AdminAudit「上传命名覆盖观察」统计卡验证
//   用法：node scripts/shot101.mjs
//   断言：混合数据占比计算 / 文件夹排除 / 空数据态 / 全绑定边界（0 除保护）/ 审计列表与 PM·CRA 回归
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
  defaultViewport: { width: 1906, height: 907 },
});
const page = await browser.newPage();
let pageErrors = 0;
page.on('pageerror', (e) => { pageErrors++; console.log('  [pageerror]', e.message); });
const shot = async (num, name, el) => {
  if (el) await el.screenshot({ path: `${SHOTS}${num}-${name}.png` });
  else await page.screenshot({ path: `${SHOTS}${num}-${name}.png` });
  console.log(`  📸 ${num}-${name}.png`);
};
const gotoLogin = async () => {
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => { sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  await sleep(700);
};
const login = async (u, p) => {
  await gotoLogin();
  await page.evaluate(({ u, p }) => {
    const inputs = [...document.querySelectorAll('input')];
    const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(inputs[0], u); set(inputs[1], p);
    [...document.querySelectorAll('button')].find((b) => b.type === 'submit')?.click();
  }, { u, p });
  await page.waitForFunction(() => !!sessionStorage.getItem('clinx-auth'), { timeout: 9000 });
  await sleep(800);
};
const nav = async (hash) => {
  await page.goto(`${BASE}/#/${hash}`, { waitUntil: 'networkidle0' });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(900);
};

/* ---- 数据注入（直接改 localStorage clinx-data-v2，立刻 reload 防内存态回写覆盖） ---- */
const mkFile = (id, withTpl) => ({
  id, name: `C3-${id}.pdf`, kind: 'pdf', projectNo: 'ON101CL01', center: '上海瑞金医院',
  uploader: '张兰', uploadDate: '2026-10-03', size: '10KB', status: 'archived',
  ...(withTpl
    ? { namingTemplateId: 'nt1', originalFilename: `raw-${id}.pdf`, displayFilename: `C3-${id}.pdf`, versionNo: '1.0', docStatus: '终版', docType: '方案' }
    : {}),
});
const mkFolder = (id, withTpl) => ({
  id, name: `C3夹-${id}`, kind: 'folder', projectNo: 'ON101CL01', center: '',
  uploader: '石磊', uploadDate: '2026-10-03', size: '0KB', status: 'archived',
  ...(withTpl ? { namingTemplateId: 'nt2' } : {}),
});
const mkLog = (id, projectNo) => ({
  id, fileId: `f-${id}`, operator: '张兰', time: `2026-10-03 10:0${id}`, action: '创建命名',
  oldValue: '', newValue: `C3-命名-${id}.pdf`, projectNo, role: 'executor', originalFilename: `raw-${id}.pdf`,
});
/* files=null 表示不动 files 字段 */
const inject = async (files, logs) => {
  await page.evaluate(({ files, logs }) => {
    const d = JSON.parse(localStorage.getItem('clinx-data-v2') || '{}');
    if (files !== null) d.files = files;
    if (logs !== null) d.namingLogs = logs;
    localStorage.setItem('clinx-data-v2', JSON.stringify(d));
  }, { files, logs });
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(900);
};

/* ---- 卡片读数探针 ---- */
const readStats = () => page.evaluate(() => {
  const find = (label) => {
    const el = [...document.querySelectorAll('div')].find((d) => d.textContent.trim() === label);
    if (!el) return null;
    const card = el.closest('.rounded-xl');
    if (!card) return null;
    const numEl = card.querySelector('[class*="32px"]');
    const pctEl = card.querySelector('.mt-2 span');
    const bar = card.querySelector('[class*="h-1.5"] > div');
    return {
      num: numEl ? numEl.childNodes[0]?.textContent.trim() : null,
      pct: pctEl?.textContent.trim() ?? null,
      barW: bar?.style.width ?? null,
    };
  };
  const cardTitle = [...document.querySelectorAll('h2')].some((h) => h.textContent.includes('上传命名覆盖观察'));
  return {
    cardTitle,
    bound: find('骨架命名 · 绑定目录新流程'),
    unbound: find('未绑定 · 旧通道上传'),
    empty: [...document.querySelectorAll('h2')].find((h) => h.textContent.includes('上传命名覆盖观察'))
      ?.closest('.rounded-2xl')?.innerText.includes('暂无数据') ?? false,
    hasNaN: document.body.innerText.includes('NaN'),
  };
});
const coverageCardEl = () => page.evaluateHandle(() =>
  [...document.querySelectorAll('h2')].find((h) => h.textContent.includes('上传命名覆盖观察'))?.closest('.rounded-2xl') ?? null);

console.log('▶ 0. admin 登录进 AUDIT');
await login('admin', '123456');
await nav('audit');
assert((await page.content()).includes('命名审计日志'), 'AUDIT 页打开（审计列表在）');

console.log('▶ A. 空数据态（files=[] → 0 除保护 + 暂无数据）');
await inject([], []);
let s = await readStats();
assert(s.cardTitle, '统计卡标题在');
assert(s.empty === true, '空数据态显示「暂无数据」');
assert(s.bound === null && s.unbound === null, '空数据不渲染双卡');
assert(s.hasNaN === false, '空数据无 NaN（0 除保护）');
await shot(311, 'c3-coverage-empty', await coverageCardEl());

console.log('▶ B. 混合数据（4 绑定 + 2 未绑定 + 3 文件夹含 1 绑定）');
await inject(
  [mkFile('b1', 1), mkFile('b2', 1), mkFile('b3', 1), mkFile('b4', 1), mkFile('u1', 0), mkFile('u2', 0),
   mkFolder('d1', 1), mkFolder('d2', 0), mkFolder('d3', 0)],
  [mkLog(1, 'ON101CL01'), mkLog(2, 'C2-TPL-001')],
);
s = await readStats();
assert(s.empty === false, '有数据时不显示暂无数据');
assert(s.bound?.num === '4', `骨架命名 4 个（实际 ${s.bound?.num}）`);
assert(s.unbound?.num === '2', `未绑定 2 个（实际 ${s.unbound?.num}）——文件夹含绑定骨架不计入`);
assert(s.bound?.pct === '占上传 67%', `绑定占比 67%（实际 ${s.bound?.pct}）`);
assert(s.unbound?.pct === '未绑定占比 33%', `未绑定占比 33%（实际 ${s.unbound?.pct}）`);
assert(s.bound?.barW === '67%' && s.unbound?.barW === '33%', `占比条宽度 67/33（实际 ${s.bound?.barW}/${s.unbound?.barW}）`);
assert(s.hasNaN === false, '无 NaN');
await shot(310, 'c3-coverage-normal', await coverageCardEl());

console.log('▶ C. 全绑定边界（unbound=0）');
await inject([mkFile('b1', 1), mkFile('b2', 1)], null);
s = await readStats();
assert(s.bound?.num === '2' && s.bound?.pct === '占上传 100%', '全绑定：2 个 100%');
assert(s.unbound?.num === '0' && s.unbound?.pct === '未绑定占比 0%', '未绑定 0 个 0%');
assert(s.unbound?.barW === '0%', `未绑定占比条 0 宽不渲染（实际 ${s.unbound?.barW}）`);
assert(s.hasNaN === false, '边界无 NaN');

console.log('▶ D. 恢复混合数据 → 整页协调感');
await inject(
  [mkFile('b1', 1), mkFile('b2', 1), mkFile('b3', 1), mkFile('b4', 1), mkFile('u1', 0), mkFile('u2', 0),
   mkFolder('d1', 1), mkFolder('d2', 0), mkFolder('d3', 0)],
  null,
);
await shot(312, 'c3-audit-fullpage');

console.log('▶ E. 回归：审计列表筛选 / PM REVIEW / CRA 端');
const listOk = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tbody tr')].filter((tr) => tr.querySelector('td'));
  return { rowCount: rows.length, total: document.body.innerText.match(/共 (\d+) 条/)?.[1] ?? null };
});
assert(listOk.rowCount === 2 && listOk.total === '2', `审计列表 2 条共存不冲突（实际 ${listOk.total}）`);
const filterOk = await page.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.textContent === 'C2-TPL-001'));
  if (!sel) return { found: false };
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, [...sel.options].find((o) => o.textContent === 'C2-TPL-001').value);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return { found: true };
});
await sleep(500);
const afterFilter = await page.evaluate(() => document.body.innerText.match(/共 (\d+) 条/)?.[1] ?? null);
assert(filterOk.found && afterFilter === '1', `项目筛选生效（筛后 ${afterFilter} 条）`);
assert((await readStats()).bound?.num === '4', '筛选日志不影响统计卡（仍 4 个）');

await login('shilei', '123456');
await nav('review');
const reviewOk = await page.evaluate(() => document.body.innerText.includes('REVIEW') || !!document.querySelector('table'));
assert(reviewOk, 'PM REVIEW 页打开不崩');

await login('zhanglan', '123456');
await nav('transfer');
const craOk = await page.evaluate(() => {
  const t = document.body.innerText;
  return t.includes('TRANSFER') && [...document.querySelectorAll('button')].some((b) => b.textContent.includes('上传'));
});
assert(craOk, 'CRA TRANSFER 页正常（不受 admin 页改动影响）');

assert(pageErrors === 0, `全程无页面报错（pageerror=${pageErrors}）`);

await browser.close();
console.log(`\n═══ C3 统计卡验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
