// R34 验证：① SITE 目录创建图纸版式（项目下拉 + 研究中心行 + -TMF- 命名 + 一份 Excel 应用全部行）
// ② SUBMISSION 上传并入新建递交弹窗（行内两渠道 + 提交即发布同步矩阵）+ 页面拖拽成行
// ③ TRANSFER 上传下拉（文件/文件夹直达）+ 页面拖拽进暂存确认流 + 新建文件夹只建空夹
// DEMO_MODE=false 空白环境；截图 216 起，存工作区根 shots/
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const BASE = 'http://localhost:5199';
const SHOTS = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/shots/';
const RJQM = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/RJQM-文件管理体系.xlsx';
const TMP = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/clinx-trials-dms/tmp-upload/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const assert = (cond, name) => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ FAIL: ${name}`); }
};

/* 本地待上传文件准备 */
fs.mkdirSync(TMP, { recursive: true });
for (const n of ['方案终版.pdf', 'PM上传方案.pdf', '拖拽甲.pdf', '拖拽乙.pdf']) fs.writeFileSync(TMP + n, `%PDF-1.4 ${n}`);

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
async function readData() {
  return page.evaluate(() => JSON.parse(localStorage.getItem('clinx-data-v2') || '{}'));
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
const bodyHas = (t) => page.evaluate((t) => document.body.innerText.includes(t), t);
const toastSeen = (t) => page.evaluate((t) => [...document.querySelectorAll('[data-sonner-toast], li, div')].some((e) => e.children.length === 0 && e.textContent.includes(t)), t);
/* 弹窗内设置原生 select 值（按 option 文本或值） */
async function setSelect(selSelector, value) {
  return page.evaluate(({ selSelector, value }) => {
    const sel = document.querySelector(selSelector);
    if (!sel) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, { selSelector, value });
}
/* 弹窗内表格设计规范断言：全部可见 th/td 居中 */
async function assertDialogCentered(label) {
  const res = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return null;
    const cells = [...dlg.querySelectorAll('th, td')].filter((el) => el.getClientRects().length);
    const bad = cells.filter((el) => getComputedStyle(el).textAlign !== 'center').length;
    return { cells: cells.length, bad };
  });
  if (res && res.cells > 0) assert(res.bad === 0, `${label}：${res.cells} 个 th/td 全部居中（规范）`);
}
/* 模拟页面级拖拽：构造 DataTransfer 并在含指定文本的卡片区域派发 drop */
async function simulateDrop(anchorText, files) {
  return page.evaluate(({ anchorText, files }) => {
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(new File([f.content], f.name, { type: 'application/pdf' }));
    const anchor = [...document.querySelectorAll('h2, h3, div, span')].find(
      (e) => e.children.length === 0 && e.textContent.trim() === anchorText,
    );
    if (!anchor) return false;
    /* 直接在 anchor（drop 包裹 div 的后代）上派发，事件沿冒泡路径经过 React onDrop 包裹层 */
    anchor.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    anchor.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    return true;
  }, { anchorText, files });
}
/* 日历面板选日 */
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
/* 翻月：面板内纯图标按钮的最后一个 = 下一月 */
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
/* 日历默认停在当月：循环翻月直到选到目标日 */
async function pickDateNav(y, m, d) {
  for (let i = 0; i < 6; i++) {
    if (await pickDate(y, m, d)) return true;
    await clickNextMonth();
    await sleep(250);
  }
  return false;
}
const shot = async (num, name) => {
  await page.screenshot({ path: `${SHOTS}${num}-${name}.png` });
  console.log(`  📸 ${num}-${name}.png`);
};

// ═══════════ 0. 空白环境：注册表为空 → SITE 弹窗整体引导 ═══════════
console.log('▶ 0. 空注册表引导');
await login('shilei', '123456', true);
await navTo('SITE TMF');
assert(await clickText('创建目录'), '打开 SITE 目录创建弹窗');
await sleep(600);
assert(await bodyHas('请先在首页配置研究中心'), '空注册表：弹窗整体显示配置引导');
assert(await page.evaluate(() => !document.querySelector('[role="dialog"] select')), '空注册表：无项目下拉（整窗引导）');
await shot(216, 'site-dialog-empty-guide');
await page.keyboard.press('Escape');
await sleep(400);

/* 注入：2 项目 3 中心 + 1 STUDY 目录（含 1 归档文件供 TMF 引入） */
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('clinx-data-v2') || '{}');
  d.centers = [
    { id: 'ct1', name: '上海瑞金医院', projectNo: 'ON101CL103', cra: '张兰' },
    { id: 'ct2', name: '北京协和医院', projectNo: 'ON101CL103', cra: '李华' },
    { id: 'ct3', name: '广州中山医院', projectNo: 'ON102CL01', cra: '李华' },
  ];
  d.catalogs = [
    { id: 'cat-st1', kind: 'study', name: 'ON101CL103 STUDY TMF', projectNo: 'ON101CL103', center: '', creator: '石磊', createDate: '2026-07-01', updateDate: '2026-07-01', size: '0KB', status: '未完成' },
  ];
  d.files = [
    { id: 'f-tmf1', name: 'ON101–研究方案–3.0–20250710', kind: 'pdf', projectNo: 'ON101CL103', center: '', uploader: '石磊', uploadDate: '2026-07-10', size: '256.0KB', status: 'archived', folderId: 'cat-st1' },
  ];
  d.submissions = [];
  d.submissionSchedule = [];
  localStorage.setItem('clinx-data-v2', JSON.stringify(d));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(700);

// ═══════════ 1. SITE 目录创建（图纸版式） ═══════════
console.log('▶ 1. SITE 目录创建弹窗（图纸版式）');
await navTo('SITE TMF');
assert(await clickText('创建目录'), '再次打开 SITE 弹窗');
await sleep(600);
const projOpts = await page.evaluate(() => {
  const sel = document.querySelector('[role="dialog"] select');
  return sel ? [...sel.options].map((o) => o.value) : null;
});
assert(projOpts && projOpts.length === 3 && projOpts[0] === '' && projOpts.includes('ON101CL103') && projOpts.includes('ON102CL01'), `项目下拉=注册表有中心的项目去重（实际 ${projOpts?.join('|')}）`);
assert(await clickText('研究中心（点击添加）', '[role="dialog"]'), '未选项目时点添加');
await sleep(300);
assert(await toastSeen('请先选择项目编号'), '未选项目拦截 toast');
assert(await setSelect('[role="dialog"] select', 'ON101CL103'), '选择项目 ON101CL103');
await sleep(300);
await clickText('研究中心（点击添加）', '[role="dialog"]');
await sleep(300);
await clickText('研究中心（点击添加）', '[role="dialog"]');
await sleep(300);
let rowInfo = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[role="dialog"] tbody tr')];
  return rows.map((r) => ({ selects: [...r.querySelectorAll('select')].map((s) => [...s.options].map((o) => o.value)), input: r.querySelector('input')?.value ?? null }));
});
assert(rowInfo.length === 2, `已添加 2 行（实际 ${rowInfo.length}）`);
assert(rowInfo[0].selects[0].includes('上海瑞金医院') && rowInfo[0].selects[0].includes('北京协和医院') && !rowInfo[0].selects[0].includes('广州中山医院'), `行 1 中心选项=该项目已配置 2 中心（实际 ${rowInfo[0].selects[0].join('|')}）`);
await setSelect('[role="dialog"] tbody tr:nth-child(1) select', '上海瑞金医院');
await sleep(300);
rowInfo = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] tbody tr')].map((r) => ({
  opts: [...(r.querySelector('select')?.options ?? [])].map((o) => o.value),
  name: r.querySelector('input')?.value ?? '',
})));
assert(rowInfo[0].name === 'ON101CL103-TMF-上海瑞金医院', `行 1 TMF 名称自动生成（实际 ${rowInfo[0].name}）`);
assert(!rowInfo[1].opts.includes('上海瑞金医院'), '行 2 选项已排除已选中心');
await setSelect('[role="dialog"] tbody tr:nth-child(2) select', '北京协和医院');
await sleep(300);
/* 可编辑：行 2 名称改自定义 */
await page.evaluate(() => {
  const input = document.querySelectorAll('[role="dialog"] tbody tr')[1].querySelector('input');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'ON101CL103-TMF-协和定制');
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(300);
rowInfo = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] tbody tr')].map((r) => r.querySelector('input')?.value ?? ''));
assert(rowInfo[1] === 'ON101CL103-TMF-协和定制', `行 2 TMF 名称可编辑（实际 ${rowInfo[1]}）`);
await assertDialogCentered('SITE 弹窗行表格');

/* 未上传 Excel 时确认禁用 */
assert(await page.evaluate(() => {
  const btn = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === '确认创建');
  return btn?.disabled === true;
}), '未上传目录 Excel：确认创建禁用');

/* 上传 RJQM Excel → 预览（先点「上传目录」建立 uploadGroupRef，再注入文件） */
await clickText('上传目录', '[role="dialog"]');
await sleep(300);
const excelInput = await page.$('[role="dialog"] input[type="file"][accept*=".xlsx"]');
assert(!!excelInput, '弹窗内 Excel 上传 input 存在');
await excelInput.uploadFile(RJQM);
await sleep(1500);
assert(await bodyHas('将创建 一级 13 个 · 二级 20 个'), 'RJQM 解析：一级 13 · 二级 20');
assert(await bodyHas('将下发到'), '预览面板目标摘要显示「将下发到」');
const previewNames = await page.evaluate(() => {
  const aside = document.querySelector('[role="dialog"] aside');
  return aside ? aside.innerText : '';
});
assert(previewNames.includes('ON101CL103-TMF-上海瑞金医院') && previewNames.includes('ON101CL103-TMF-协和定制'), '预览逐行最终名称 = 两行 TMF 名称');
assert(await page.evaluate(() => !!document.querySelector('[role="dialog"] aside ul li')), '预览目录树渲染');
await shot(217, 'site-dialog-rows-preview');

/* 校验：有空中心行时确认阻止（项目 2 中心已全部占用，⊕ 会被拒——改为把行 2 中心重置为空来构造空行） */
await setSelect('[role="dialog"] tbody tr:nth-child(2) select', '');
await sleep(300);
await clickText('确认创建', '[role="dialog"]');
await sleep(300);
assert(await toastSeen('存在未选择研究中心的行'), '未选中心行拦截 toast');
/* 恢复行 2 中心（nameDirty=true，自定义名称保留不覆盖） */
await setSelect('[role="dialog"] tbody tr:nth-child(2) select', '北京协和医院');
await sleep(300);
const row2Name = await page.evaluate(() => document.querySelectorAll('[role="dialog"] tbody tr')[1]?.querySelector('input')?.value ?? '');
assert(row2Name === 'ON101CL103-TMF-协和定制', `行 2 重选中心后自定义名称保留（实际 ${row2Name}）`);

/* 确认创建 → 落库 */
await clickText('确认创建', '[role="dialog"]');
await sleep(900);
let data = await readData();
const siteCats = (data.catalogs || []).filter((c) => c.kind === 'site');
assert(siteCats.length === 2, `落库 2 个 SITE 目录（实际 ${siteCats.length}）`);
assert(siteCats.some((c) => c.name === 'ON101CL103-TMF-上海瑞金医院' && c.center === '上海瑞金医院'), '目录 1 名称/中心正确（-TMF- 命名）');
assert(siteCats.some((c) => c.name === 'ON101CL103-TMF-协和定制' && c.center === '北京协和医院'), '目录 2 自定义名称落库');
const foldersOf = (cid) => (data.files || []).filter((f) => f.kind === 'folder' && f.folderId === cid);
assert(siteCats.every((c) => foldersOf(c.id).length === 33), `两目录各 33 文件夹（实际 ${siteCats.map((c) => foldersOf(c.id).length).join('/')}）`);
await shot(218, 'site-tmf-after-create');

// ═══════════ 2. SUBMISSION：上传并入新建弹窗 + 页面拖拽 ═══════════
console.log('▶ 2. SUBMISSION');
await navTo('SUBMISSION');
const toolbarBtns = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('section, div')].filter((d) => d.children.length && d.textContent.includes('递交文件'));
  const card = document.querySelectorAll('table')[1]?.closest('div');
  const scope = card?.parentElement ?? document.body;
  return [...scope.querySelectorAll('button')].map((b) => b.textContent.trim());
});
assert(!toolbarBtns.includes('上传'), `递交文件工具栏无独立「上传」按钮（实际 ${toolbarBtns.filter((t) => t.length < 6).join('|')}）`);
assert(await clickText('新建'), '打开新建递交弹窗');
await sleep(600);
const dlgW = await page.evaluate(() => document.querySelector('[role="dialog"]')?.getBoundingClientRect().width ?? 0);
assert(dlgW >= 900, `弹窗已加宽（实际 ${Math.round(dlgW)}px）`);

/* 行 1：本地上传 → 主题默认带入；选项目；日历选时限 */
await page.evaluate(() => {
  const row = document.querySelector('[role="dialog"] tbody tr');
  [...row.querySelectorAll('button')].find((b) => b.textContent.includes('本地上传'))?.click();
});
await sleep(300);
const subFileInput = await page.$('[role="dialog"] input[type="file"][multiple]');
assert(!!subFileInput, '新建递交弹窗本地上传 input 存在');
await subFileInput.uploadFile(TMP + '方案终版.pdf');
await sleep(400);
let subRow = await page.evaluate(() => {
  const r = document.querySelector('[role="dialog"] tbody tr');
  return {
    topic: r.querySelector('input')?.value ?? '',
    chips: [...r.querySelectorAll('span')].some((s) => s.textContent.includes('方案终版.pdf')),
  };
});
assert(subRow.topic === '方案终版', `行 1 主题默认=文件名去扩展名（实际 ${subRow.topic}）`);
assert(subRow.chips, '行 1 文件芯片显示');
await setSelect('[role="dialog"] tbody tr:nth-child(1) select', 'ON101CL103');
await sleep(200);
await page.evaluate(() => {
  [...document.querySelectorAll('[role="dialog"] tbody tr')[0].querySelectorAll('button')].find((b) => b.textContent.includes('选择日期'))?.click();
});
await sleep(500);
assert(await pickDateNav(2026, 9, 30), '行 1 日历选 2026-09-30');
await sleep(300);

/* 行 2：新建行 → 从 STUDY TMF 选择 → 主题自定义 */
await page.evaluate(() => {
  [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === '新建')?.click();
});
await sleep(300);
const rowCnt2 = await page.evaluate(() => ({
  n: document.querySelectorAll('[role="dialog"] tbody tr').length,
  btns: [...document.querySelectorAll('[role="dialog"] button')].map((b) => b.textContent.trim()).filter((t) => t.length < 8),
}));
assert(rowCnt2.n === 2, `新建第 2 行（实际行数 ${rowCnt2.n}，按钮 ${rowCnt2.btns.join('|')}）`);
await page.evaluate(() => {
  const row = document.querySelectorAll('[role="dialog"] tbody tr')[1];
  [...row.querySelectorAll('button')].find((b) => b.textContent.includes('从 STUDY TMF 选择'))?.click();
});
await sleep(500);
assert(await page.evaluate(() => document.querySelectorAll('[role="dialog"]').length === 2), 'TMF 选择嵌套弹窗打开');
await page.evaluate(() => {
  const dlg = document.querySelectorAll('[role="dialog"]')[1];
  [...dlg.querySelectorAll('button')].find((b) => b.textContent.includes('ON101CL103 STUDY TMF'))?.click();
});
await sleep(400);
await page.evaluate(() => {
  const dlg = document.querySelectorAll('[role="dialog"]')[1];
  dlg.querySelector('input[type="checkbox"]')?.click();
});
await sleep(200);
await page.evaluate(() => {
  const dlg = document.querySelectorAll('[role="dialog"]')[1];
  [...dlg.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('确认引入'))?.click();
});
await sleep(400);
subRow = await page.evaluate(() => {
  const r = document.querySelectorAll('[role="dialog"] tbody tr')[1];
  return {
    project: r.querySelector('select')?.value ?? '',
    chips: [...r.querySelectorAll('span')].some((s) => s.textContent.includes('ON101–研究方案–3.0–20250710')),
  };
});
assert(subRow.chips, '行 2 TMF 文件芯片显示');
assert(subRow.project === 'ON101CL103', `行 2 项目编号跟随 TMF 文件填入（实际 ${subRow.project}）`);
await page.evaluate(() => {
  const input = document.querySelectorAll('[role="dialog"] tbody tr')[1].querySelector('input');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'TMF 引入递交');
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await sleep(200);
await assertDialogCentered('新建递交弹窗');
await shot(219, 'submission-dialog-two-rows');

/* 提交 → 创建并发布 → 矩阵同步 */
await page.evaluate(() => {
  [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === '提交')?.click();
});
await sleep(900);
data = await readData();
assert((data.submissions || []).length === 2 && data.submissions.every((s) => s.published), `2 条递交落库且已发布（实际 ${(data.submissions || []).length}）`);
const topics = (data.submissionSchedule || []).map((r) => r.topic);
assert(topics.includes('方案终版') && topics.includes('TMF 引入递交'), `矩阵同步 2 行（实际 ${topics.join('|')}）`);
const row1 = (data.submissionSchedule || []).find((r) => r.topic === '方案终版');
assert(row1?.deadline === '2026-09-30', `行 1 时限写入矩阵（实际 ${row1?.deadline}）`);
assert(await bodyHas('方案终版') && await bodyHas('TMF 引入递交'), '递交概况矩阵 DOM 显示两行');
await shot(220, 'submission-matrix-after-submit');

/* 页面级拖拽：本地文件拖到递交文件列表区 → 弹窗自动成行 */
assert(await simulateDrop('递交文件', [{ name: '拖拽方案.pdf', content: 'x' }]), '派发 drop 到递交文件区域');
await sleep(800);
const dropInfo = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return null;
  const r = dlg.querySelector('tbody tr');
  return { rows: dlg.querySelectorAll('tbody tr').length, topic: r?.querySelector('input')?.value ?? '' };
});
assert(dropInfo && dropInfo.rows === 1 && dropInfo.topic === '拖拽方案', `拖拽松手弹窗成行且主题默认（实际 ${JSON.stringify(dropInfo)}）`);
await shot(221, 'submission-drop-row');
await page.keyboard.press('Escape');
await sleep(500);

// ═══════════ 3. TRANSFER：上传下拉 + 页面拖拽 + 新建文件夹 ═══════════
console.log('▶ 3. TRANSFER');
await navTo('TRANSFER');
assert(await bodyHas('新建文件夹'), '工具栏「＋新建文件夹」在位');
assert(!(await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === '新建'))), '无独立「新建」按钮');
/* 上传下拉 */
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s/g, '') === '上传')?.click();
});
await sleep(300);
assert(await bodyHas('上传文件') && await bodyHas('上传文件夹'), '上传下拉两选项');
await shot(222, 'transfer-upload-dropdown');
await clickText('上传文件');
await sleep(700);
assert(await page.evaluate(() => !!document.querySelector('[role="dialog"]')), '上传弹窗打开（上传文件）');
await setSelect('[role="dialog"] select', 'ON101CL103');
await sleep(200);
const upInput = await page.$('[role="dialog"] input[type="file"][multiple]:not([webkitdirectory])');
assert(!!upInput, '上传弹窗文件 input 存在');
await upInput.uploadFile(TMP + 'PM上传方案.pdf');
await sleep(800);
assert(await bodyHas('PM上传方案'), '下拉「上传文件」走通：文件入列表');

/* 上传文件夹 */
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s/g, '') === '上传')?.click();
});
await sleep(300);
await clickText('上传文件夹');
await sleep(700);
const dirInput = await page.$('[role="dialog"] input[webkitdirectory]');
assert(!!dirInput, '上传弹窗文件夹 input 存在');
await setSelect('[role="dialog"] select', 'ON101CL103');
await sleep(200);
/* CDP uploadFile 对 webkitdirectory input 无效（input.files 为空）：改为页内 DataTransfer 赋值 + change，
   同时给 File.prototype 打 webkitRelativePath 补丁模拟真实选文件夹行为 */
await page.evaluate(() => {
  Object.defineProperty(File.prototype, 'webkitRelativePath', { configurable: true, get() { return `R34测试文件夹/${this.name}`; } });
  const dt = new DataTransfer();
  dt.items.add(new File(['a'], '文件夹子文件甲.pdf', { type: 'application/pdf' }));
  dt.items.add(new File(['b'], '文件夹子文件乙.pdf', { type: 'application/pdf' }));
  const inp = document.querySelector('[role="dialog"] input[webkitdirectory]');
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
});
await sleep(900);
assert(await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('clinx-data-v2') || '{}');
  const files = d.files || [];
  const folder = files.find((f) => f.kind === 'folder' && f.name === 'R34测试文件夹' && f.uploader === '石磊');
  return !!folder && files.filter((f) => f.parentId === folder.id).length === 2;
}), '下拉「上传文件夹」走通：文件夹条目+2 子文件落库');
/* 关闭上传弹窗，避免遮挡后续页面拖拽 */
await page.keyboard.press('Escape');
await sleep(600);
assert(await page.evaluate(() => !document.querySelector('[role="dialog"]')), '上传弹窗已关闭');

/* 页面级拖拽 → 上传弹窗暂存确认流 */
assert(await simulateDrop('文件上传', [{ name: '拖拽甲.pdf', content: 'a' }, { name: '拖拽乙.pdf', content: 'b' }]), '派发 drop 到 TRANSFER 列表区');
await sleep(800);
const stagedInfo = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  return dlg ? dlg.innerText : null;
});
assert(stagedInfo && stagedInfo.includes('待上传（2 个文件'), `拖拽进入暂存确认流（实际 ${stagedInfo ? stagedInfo.slice(0, 150).replace(/\n/g, '⏎') : '弹窗未开'}）`);
assert(stagedInfo && stagedInfo.includes('拖拽甲.pdf') && stagedInfo.includes('拖拽乙.pdf'), '暂存列表两行文件在位');
await setSelect('[role="dialog"] select', 'ON101CL103');
await sleep(200);
await shot(223, 'transfer-drop-staged');
await page.evaluate(() => {
  [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim().startsWith('确认上传'))?.click();
});
await sleep(900);
data = await readData();
assert((data.files || []).some((f) => f.name === '拖拽甲' || f.name === '拖拽甲.pdf' || f.name.includes('拖拽甲')), '拖拽文件确认后落库');
await shot(224, 'transfer-list-after-drop');

/* 新建文件夹只建空夹 + 行内命名 */
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s/g, '') === '新建文件夹')?.click();
});
await sleep(500);
assert(await page.evaluate(() => {
  const input = [...document.querySelectorAll('td input')].find((i) => i.value === '新建文件夹');
  return !!input;
}), '新建文件夹成行并进入命名态');
await page.evaluate(() => {
  const input = [...document.querySelectorAll('td input')].find((i) => i.value === '新建文件夹');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'R34 空文件夹');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
});
await sleep(500);
data = await readData();
const newFolder = (data.files || []).find((f) => f.name === 'R34 空文件夹');
assert(newFolder && newFolder.kind === 'folder' && !(data.files || []).some((f) => f.parentId === newFolder.id), '空文件夹落库且无子文件');

await browser.close();
console.log(`\n═══ R34 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
