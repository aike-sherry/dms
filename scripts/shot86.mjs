// R33 验证：全系统表格居中规范化（标题居中、字段居中、间距协调——长期设计规范）
// 断言每页全部可见 th/td 计算 text-align=center；名称列整体 flex justify-center；
// 表内输入框一律 text-center；超长名称 truncate 省略号生效。
// 覆盖：PM 7 页 + 目录创建弹窗 + 版本历史弹窗 / 执行端 5 页 / admin 3 页。
// DEMO_MODE=false；截图 197 起，存工作区根 shots/
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
  await sleep(400);
}
async function relogin(u, p) {
  await page.evaluate(() => sessionStorage.removeItem('clinx-auth'));
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(500);
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
  await sleep(400);
}
/* 侧栏导航（大小写不敏感：Home/Transfer/Favorite 与 SUBMISSION 等并存） */
async function navTo(name) {
  await page.evaluate((name) => {
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim().toUpperCase() === name.toUpperCase(),
    )?.click();
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

/* ── 核心断言：当前页面（含弹窗 portal）全部可见 th/td 计算样式居中；
      名称列 NameTd 整体 flex 容器 justify-center；表内文本输入框 text-center ── */
async function assertCentered(label) {
  const res = await page.evaluate(() => {
    const vis = (el) => el.getClientRects().length > 0;
    const cells = [...document.querySelectorAll('th, td')].filter(vis);
    const bad = [];
    for (const el of cells) {
      const ta = getComputedStyle(el).textAlign;
      if (ta !== 'center') bad.push(`${el.tagName}「${el.textContent.trim().slice(0, 12)}」=${ta}`);
    }
    const wraps = [...document.querySelectorAll('td > span.flex.w-full')].filter(vis);
    const badFlex = wraps.filter((el) => getComputedStyle(el).justifyContent !== 'center').length;
    const inputs = [...document.querySelectorAll('td input')].filter((i) => vis(i) && i.type !== 'checkbox' && i.type !== 'radio');
    const badInputs = inputs.filter((i) => getComputedStyle(i).textAlign !== 'center').length;
    return { cells: cells.length, bad: bad.slice(0, 6), badCount: bad.length, wraps: wraps.length, badFlex, inputs: inputs.length, badInputs };
  });
  if (res.cells === 0) { console.log(`  - ${label}：无可见表格单元格，跳过`); return; }
  assert(res.badCount === 0, `${label}：${res.cells} 个 th/td 全部居中${res.badCount ? `（异常 ${res.badCount}：${res.bad.join('；')}）` : ''}`);
  if (res.wraps > 0) assert(res.badFlex === 0, `${label}：名称列整体 flex 居中（${res.wraps} 个容器${res.badFlex ? `，异常 ${res.badFlex}` : ''}）`);
  if (res.inputs > 0) assert(res.badInputs === 0, `${label}：表内输入框居中（${res.inputs} 个${res.badInputs ? `，异常 ${res.badInputs}` : ''}）`);
}
async function shot(num, name) {
  await page.screenshot({ path: `${SHOTS}${num}-${name}.png` });
  console.log(`  📸 ${num}-${name}.png`);
}

// ═══════════ 0. 造数：fresh 登录后注入全状态数据 ═══════════
console.log('▶ 0. 登录 PM 并注入造数');
await login('shilei', '123456', true);
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('clinx-data-v2') || '{}');
  d.centers = [
    { id: 'ct1', name: '上海瑞金医院', projectNo: 'ON101CL103', cra: '张兰' },
    { id: 'ct2', name: '北京协和医院', projectNo: 'ON102CL01', cra: '李华' },
  ];
  d.catalogs = [
    { id: 'cat-si1', kind: 'site', name: 'ON101CL103–SITE TMF —上海瑞金医院', projectNo: 'ON101CL103', center: '上海瑞金医院', creator: '石磊', createDate: '2026-01-01', updateDate: '2026-07-01', size: '0KB', status: '未完成' },
    { id: 'cat-st1', kind: 'study', name: 'ON101CL103–STUDY TMF', projectNo: 'ON101CL103', center: '', creator: '石磊', createDate: '2026-01-01', updateDate: '2026-07-01', size: '0KB', status: '未完成' },
  ];
  d.files = [
    { id: 'tf1', name: 'ON101–试验方案–3.0–20250710', kind: 'pdf', projectNo: 'ON101CL103', center: '上海瑞金医院', uploader: '石磊', uploadDate: '2026-07-10', size: '256.0KB', status: 'uploaded' },
    { id: 'tf2', name: 'ON101–安全性汇总分析–20250605', kind: 'pdf', projectNo: 'ON101CL103', center: '上海瑞金医院', uploader: '石磊', uploadDate: '2026-06-05', size: '145.8KB', status: 'pending' },
    { id: 'tf-long', name: 'ON101CL103–超长效阿片类药物防滥用风险评估与管控计划文件暨多中心协同审查会议纪要汇编–终版V3–20260720', kind: 'pdf', projectNo: 'ON101CL103', center: '上海瑞金医院', uploader: '石磊', uploadDate: '2026-07-20', size: '512.0KB', status: 'uploaded' },
    { id: 'rv1', name: 'ON101–研究者手册–1.0–20260401', kind: 'pdf', projectNo: 'ON101CL103', center: '北京协和医院', uploader: '李华', uploadDate: '2026-04-01', size: '312.8KB', status: 'pending' },
    { id: 'rv2', name: 'ON102–伦理递交信–上海瑞金医院–20260420', kind: 'pdf', projectNo: 'ON102CL01', center: '上海瑞金医院', uploader: '张兰', uploadDate: '2026-04-20', size: '193.1KB', status: 'pending' },
    { id: 'ar1', name: 'ON101–伦理批件–上海瑞金医院–20250110', kind: 'pdf', projectNo: 'ON101CL103', center: '上海瑞金医院', uploader: '张兰', uploadDate: '2026-01-10', size: '188.2KB', status: 'archived', folderId: 'cat-si1' },
    { id: 'ar2', name: 'ON101–试验方案–2.0–20250301', kind: 'pdf', projectNo: 'ON101CL103', center: '上海瑞金医院', uploader: '张兰', uploadDate: '2026-03-01', size: '420.5KB', status: 'archived', folderId: 'cat-si1' },
    { id: 'ar3', name: 'ON101–研究方案–3.0–20250710', kind: 'pdf', projectNo: 'ON101CL103', center: '上海瑞金医院', uploader: '石磊', uploadDate: '2026-07-10', size: '256.0KB', status: 'archived', folderId: 'cat-st1' },
  ];
  d.submissions = [
    { id: 'sub1', topic: 'R33 版式验证递交', fileName: '方案.pdf', kind: 'pdf', projectNo: 'ON101CL103', uploadDate: '2026-07-20', size: '10KB', published: true, deadline: '2026-09-30' },
  ];
  d.submissionSchedule = [
    { id: 'sub1', topic: 'R33 版式验证递交', publishDate: '2026-07-20', deadline: '2026-09-30', dates: { 上海瑞金医院: '2026-07-20' } },
  ];
  d.favorites = { tf1: '2026-07-20', ar1: '2026-07-21' };
  localStorage.setItem('clinx-data-v2', JSON.stringify(d));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(700);

// ═══════════ 1. PM 端 7 页 ═══════════
console.log('▶ 1. PM 端（石磊）');
await navTo('HOME');
await page.evaluate(() => {
  [...document.querySelectorAll('h2, h3, div')].find((d) => d.children.length === 0 && d.textContent.trim() === '研究中心管理')?.scrollIntoView({ block: 'center' });
});
await sleep(300);
await assertCentered('PM HOME（研究中心管理表）');
await shot(197, 'pm-home');

await navTo('SUBMISSION');
await assertCentered('PM SUBMISSION（递交矩阵）');
await shot(198, 'pm-submission');

await navTo('TRANSFER');
await assertCentered('PM TRANSFER（文件列表）');
const truncOk = await page.evaluate(() => {
  const els = [...document.querySelectorAll('td .truncate')].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 2);
  return els.length;
});
assert(truncOk > 0, `PM TRANSFER：超长名称 truncate 省略号生效（截断元素 ${truncOk} 个）`);
await shot(199, 'pm-transfer');

/* 版本历史弹窗（名称列 History 图标触发） */
console.log('▶ 1b. 版本历史弹窗');
const histOpened = await page.evaluate(() => {
  const btn = document.querySelector('button[title^="查看版本历史"]');
  if (btn) { btn.click(); return true; }
  return false;
});
assert(histOpened, '版本历史弹窗已打开');
await sleep(600);
await assertCentered('版本历史弹窗（版本链表）');
await shot(200, 'pm-version-hist-dialog');
await page.keyboard.press('Escape');
await sleep(500);

await navTo('REVIEW');
await assertCentered('PM REVIEW（待审核列表）');
await shot(201, 'pm-review');

await navTo('STUDY TMF');
await assertCentered('PM STUDY TMF（目录列表）');
await shot(202, 'pm-study-tmf');
/* 进入目录明细文件表 */
const detailOpened = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('ON101CL103–STUDY TMF'));
  if (btn) { btn.click(); return true; }
  return false;
});
await sleep(700);
if (detailOpened) {
  await assertCentered('PM STUDY TMF 明细（归档文件表）');
  await shot(203, 'pm-study-tmf-detail');
} else {
  console.log('  - STUDY TMF 明细入口未找到，跳过');
}

await navTo('SITE TMF');
await assertCentered('PM SITE TMF（目录列表）');
await shot(204, 'pm-site-tmf');

/* 目录创建弹窗（含 STUDY 裸表） */
console.log('▶ 1c. 目录创建弹窗');
assert(await clickText('创建目录'), '打开目录创建弹窗');
await sleep(600);
await assertCentered('目录创建弹窗（模板表）');
await shot(205, 'pm-catalog-dialog');
await page.keyboard.press('Escape');
await sleep(400);
await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (dlg) [...dlg.querySelectorAll('button')].find((b) => b.textContent.trim() === '取消')?.click();
});
await sleep(400);

await navTo('FAVORITE');
await assertCentered('PM FAVORITE（收藏表）');
await shot(206, 'pm-favorite');

// ═══════════ 2. 执行端 5 页 ═══════════
console.log('▶ 2. 执行端（张兰）');
await relogin('zhanglan', '123456');
await navTo('HOME');
await assertCentered('执行端 HOME');
await shot(207, 'ex-home');
await navTo('SUBMISSION');
await assertCentered('执行端 SUBMISSION（递交矩阵）');
await shot(208, 'ex-submission');
await navTo('TRANSFER');
await assertCentered('执行端 TRANSFER');
await shot(209, 'ex-transfer');
await navTo('SITE TMF');
await assertCentered('执行端 SITE TMF');
await shot(210, 'ex-site-tmf');
await navTo('FAVORITE');
await assertCentered('执行端 FAVORITE');
await shot(211, 'ex-favorite');

// ═══════════ 3. admin 3 页 ═══════════
console.log('▶ 3. admin 端');
await relogin('admin', '123456');
await sleep(500);
await assertCentered('admin DASHBOARD');
await shot(212, 'admin-dashboard');
await navTo('ACCOUNTS');
await assertCentered('admin ACCOUNTS');
await shot(213, 'admin-accounts');
await navTo('CUSTOMERS');
await assertCentered('admin CUSTOMERS');
await shot(214, 'admin-customers');

await browser.close();
console.log(`\n═══ R33 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
