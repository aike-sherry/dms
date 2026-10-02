// R44 HOME 统计区改造 + 目录创建弹窗分段控件验证
//   A PM HOME 1906×907：SITE TMF 2×2 网格（4 卡两行）、两卡顶对齐不强行等高、无溢出
//   B PM HOME 1366×768：不崩不溢出；C 执行端 HOME 同款检查
//   D STUDY 目录弹窗：宽度 ≥1000、分段控件存在；选模板落库 / 上传 RJQM Excel 落库；SITE 分支回归不崩
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:5199';
const SHOTS = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/shots/';
const XLSX = 'C:\\Users\\huawe\\Documents\\Kimi\\Workspaces\\ClinicalTrialsDocumentM\\RJQM-文件管理体系.xlsx';
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
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
const shot = async (num, name) => {
  await page.screenshot({ path: `${SHOTS}${num}-${name}.png` });
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

/* HOME 统计区探针 */
const homeProbe = () => page.evaluate(() => {
  const cardOf = (t) => [...document.querySelectorAll('h2')].find((h) => h.textContent === t)?.closest('div.rounded-2xl');
  const left = cardOf('STUDY TMF'), right = cardOf('SITE TMF');
  const grid = right?.querySelector('.grid.grid-cols-2');
  const kids = grid ? [...grid.children] : [];
  return {
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    gridCols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
    cardCount: kids.length,
    rowTops: [...new Set(kids.map((k) => k.offsetTop))].length,
    pieH: left?.querySelector('svg.recharts-surface')?.getAttribute('height') ?? null,
    leftH: left?.offsetHeight ?? 0,
    rightH: right?.offsetHeight ?? 0,
    topAligned: left && right ? Math.abs(left.offsetTop - right.offsetTop) <= 2 : false,
    numSize: kids[0] ? getComputedStyle(kids[0].querySelector('.text-\\[32px\\]') || kids[0]).fontSize : null,
  };
});

/* 清空演示数据保证空白环境 */
await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
await page.evaluate(() => { localStorage.removeItem('clinx-data-v2'); });

// ═══════════ A. PM HOME 1906×907 ═══════════
console.log('▶ A. PM HOME 1906×907');
await login('shilei', '123456');
await nav('home');
{
  const p = await homeProbe();
  assert(p.gridCols === 2, `SITE TMF 2 列网格（实际 ${p.gridCols} 列）`);
  assert(p.cardCount === 4 && p.rowTops === 2, `4 卡两行（卡数 ${p.cardCount}、行数 ${p.rowTops}）`);
  assert(p.pieH === '176', `圆环收一档（SVG 高 ${p.pieH}px）`);
  assert(p.topAligned, '两卡顶对齐');
  assert(p.leftH !== p.rightH && Math.abs(p.leftH - p.rightH) >= 4, `取消强行等高、底部错落（左 ${p.leftH}px / 右 ${p.rightH}px）`);
  assert(p.leftH < 400 && p.rightH < 400, `两卡整体紧凑（左 ${p.leftH} / 右 ${p.rightH}）`);
  assert(p.overflowX <= 1, `无横向溢出（超出 ${p.overflowX}px）`);
}
await shot(298, 'r44-home-1906');

// ═══════════ B. PM HOME 1366×768 ═══════════
console.log('▶ B. PM HOME 1366×768');
await page.setViewport({ width: 1366, height: 768 });
await nav('home');
{
  const p = await homeProbe();
  assert(p.gridCols === 2 && p.cardCount === 4 && p.rowTops === 2, `1366 下仍 2×2（列 ${p.gridCols}、行 ${p.rowTops}）`);
  assert(p.topAligned, '1366 下两卡顶对齐');
  assert(p.overflowX <= 1, `1366 无横向溢出（超出 ${p.overflowX}px）`);
}
await shot(299, 'r44-home-1366');

// ═══════════ C. 执行端 HOME ═══════════
console.log('▶ C. 执行端 HOME（zhanglan）');
await page.setViewport({ width: 1906, height: 907 });
await login('zhanglan', '123456');
await nav('home');
{
  const p = await homeProbe();
  assert(p.gridCols === 2 && p.cardCount === 4 && p.rowTops === 2, `执行端 2×2 网格（列 ${p.gridCols}、行 ${p.rowTops}）`);
  assert(p.topAligned && p.overflowX <= 1, '执行端顶对齐且无溢出');
}
await shot(300, 'r44-exhome');

// ═══════════ D. STUDY 目录弹窗 ═══════════
console.log('▶ D. STUDY 目录弹窗分段控件');
await login('shilei', '123456');
await nav('study');
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.includes('创建目录'))?.click(); });
await page.waitForFunction(() => !!document.querySelector('[role="dialog"]'), { timeout: 5000 });
await sleep(600);
const dlgProbe = () => page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const pill = [...dlg.querySelectorAll('div.rounded-full')].find((d) => d.textContent.includes('标准模板') && d.textContent.includes('上传 Excel'));
  return {
    w: dlg.getBoundingClientRect().width,
    pill: !!pill,
    segBtns: pill ? [...pill.querySelectorAll('button')].map((b) => b.textContent.trim()) : [],
    select: !!dlg.querySelector('tbody select'),
  };
});
{
  const d = await dlgProbe();
  assert(d.w >= 1000, `弹窗加宽（实际 ${Math.round(d.w)}px，≥5xl 1024 量级）`);
  assert(d.pill && d.segBtns.some((t) => t.includes('标准模板')) && d.segBtns.some((t) => t.includes('上传 Excel')), `胶囊分段控件存在（${d.segBtns.join('｜')}）`);
  assert(!d.select, '未选时单元格无堆叠下拉');
}
await shot(301, 'r44-dialog-segmented');

/* D1 模板来源：点「标准模板」→ 展开下拉 → 选第一个模板 → 芯片出现 → 确认创建落库 */
await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const pill = [...dlg.querySelectorAll('div.rounded-full')].find((d) => d.textContent.includes('标准模板'));
  [...pill.querySelectorAll('button')].find((b) => b.textContent.includes('标准模板'))?.click();
});
await sleep(400);
{
  const d = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const sel = dlg.querySelector('tbody select');
    if (!sel) return { select: false };
    const opt = [...sel.options].find((o) => o.value);
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return { select: true, optText: opt.textContent };
  });
  assert(d.select, '点「标准模板」展开模板下拉');
  await sleep(500);
  const chip = await page.evaluate(() => document.querySelector('[role="dialog"] tbody')?.textContent ?? '');
  assert(chip.includes('标准模板：'), `选中模板后芯片显示（${d.optText}）`);
  /* 填项目编号后确认创建（注意 tbody 首个 input 是行首 checkbox，用 placeholder 定位编号框） */
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const inp = [...dlg.querySelectorAll('tbody input')].find((i) => i.placeholder?.includes('项目编号'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, 'R44-TPL-001');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(300);
  await page.evaluate(() => { [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === '确认创建')?.click(); });
  await sleep(900);
  const stored = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('clinx-data-v2') || '{}');
    return (d.catalogs || []).filter((c) => c.projectNo === 'R44-TPL-001').length;
  });
  assert(stored > 0, `模板来源创建成功落库（R44-TPL-001 目录 ${stored} 条）`);
}
await shot(302, 'r44-dialog-template');

/* D2 上传 Excel 来源：新建行 → 上传 Excel 段 → uploadFile → 芯片文件名 → 确认创建落库 */
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.includes('创建目录'))?.click(); });
await page.waitForFunction(() => !!document.querySelector('[role="dialog"]'), { timeout: 5000 });
await sleep(500);
await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const pill = [...dlg.querySelectorAll('div.rounded-full')].find((d) => d.textContent.includes('上传 Excel'));
  [...pill.querySelectorAll('button')].find((b) => b.textContent.includes('上传 Excel'))?.click();
});
await sleep(300);
{
  const fi = await page.$('[role="dialog"] input[type="file"]');
  assert(!!fi, '点「上传 Excel」段后文件输入就位');
  if (fi) await fi.uploadFile(XLSX);
  await sleep(1200);
  const chip = await page.evaluate(() => document.querySelector('[role="dialog"] tbody')?.textContent ?? '');
  assert(chip.includes('RJQM-文件管理体系.xlsx'), '上传后芯片显示文件名');
  await shot(303, 'r44-dialog-excel');
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const inp = [...dlg.querySelectorAll('tbody input')].find((i) => i.placeholder?.includes('项目编号'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, 'R44-XLS-001');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(300);
  await page.evaluate(() => { [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === '确认创建')?.click(); });
  await sleep(1200);
  const stored = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('clinx-data-v2') || '{}');
    return {
      cat: (d.catalogs || []).filter((c) => c.projectNo === 'R44-XLS-001').length,
      folders: (d.files || []).filter((f) => f.projectNo === 'R44-XLS-001').length,
    };
  });
  assert(stored.cat > 0 && stored.folders > 0, `Excel 来源创建成功落库（目录 ${stored.cat} 条、文件夹节点 ${stored.folders} 个）`);
}

/* D3 SITE 分支回归：弹窗打开不崩（空白环境无中心 → 引导提示或表格二选一正常渲染） */
console.log('▶ D3. SITE 分支回归');
await nav('site');
await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.includes('创建目录'))?.click(); });
await page.waitForFunction(() => !!document.querySelector('[role="dialog"]'), { timeout: 5000 });
await sleep(600);
{
  const t = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '');
  assert(t.includes('请先在首页配置研究中心') || t.includes('研究中心'), 'SITE 弹窗正常渲染（注册表空引导/行表格）');
}
await shot(304, 'r44-dialog-site');

await browser.close();
console.log(`\n═══ R44 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
