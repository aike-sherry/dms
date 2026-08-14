// R30 验证：SITE TMF 目录创建弹窗改造为「项目目录批量下发」表单模式
// 用法: node scripts/shot83.mjs <W> <H> <截图编号基数>   例: node scripts/shot83.mjs 1280 800 183
// DEMO_MODE=false，PM shilei；注入 6 家中心（瑞金已建目录）验证默认全选/标灰不勾/下发预览/双项目落库
import puppeteer from 'puppeteer-core';

const W = Number(process.argv[2] || 1280);
const H = Number(process.argv[3] || 800);
const SHOT_BASE = Number(process.argv[4] || 183);
const BASE = 'http://localhost:5199';
const SHOTS = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/shots/';
const RJQM = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/RJQM-文件管理体系.xlsx';
const VARIANT = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/tmp/test-catalog-r30-b.xlsx';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const assert = (cond, name) => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ FAIL: ${name}`); }
};

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: [`--window-size=${W + 95},${H + 100}`],
  defaultViewport: { width: W, height: H },
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
async function setDialogInput(sectionIdx, ph, value) {
  await page.evaluate(({ sectionIdx, ph, value }) => {
    const dlg = document.querySelector('[role="dialog"]');
    const sec = dlg.querySelectorAll('section')[sectionIdx];
    const el = [...sec.querySelectorAll('input')].find((i) => (i.placeholder || '').includes(ph));
    if (!el) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { sectionIdx, ph, value });
}
async function uploadForSection(sectionIdx, filePath) {
  await page.evaluate((sectionIdx) => {
    const dlg = document.querySelector('[role="dialog"]');
    const sec = dlg.querySelectorAll('section')[sectionIdx];
    [...sec.querySelectorAll('button')].find((b) => b.textContent.includes('上传目录'))?.click();
  }, sectionIdx);
  await sleep(200);
  const input = await page.$('[role="dialog"] input[type="file"]');
  await input.uploadFile(filePath);
  await sleep(900);
}
async function chipClick(name) {
  return page.evaluate((name) => {
    const dlg = document.querySelector('[role="dialog"]');
    const chip = [...dlg.querySelectorAll('section label')].find((l) => l.textContent.includes(name) && l.querySelector('input[type=checkbox]'));
    if (!chip) return false;
    chip.click();
    return true;
  }, name);
}
async function dialogState() {
  return page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return null;
    const sections = [...dlg.querySelectorAll('section')];
    const chipsOf = (sec) =>
      [...sec.querySelectorAll('label')]
        .filter((l) => l.querySelector('input[type=checkbox]') && !l.textContent.includes('全选'))
        .map((l) => ({
          text: l.textContent.trim(),
          checked: l.querySelector('input').checked,
          built: l.textContent.includes('已建目录'),
        }));
    const aside = dlg.querySelector('aside');
    return {
      hasTable: !!dlg.querySelector('table'),
      sectionCount: sections.length,
      chips: chipsOf(dlg),
      chipsPerSection: sections.map(chipsOf),
      asideText: aside ? aside.innerText : null,
      inputs: [...dlg.querySelectorAll('input[placeholder]')].map((i) => ({ ph: i.placeholder, value: i.value })),
    };
  });
}

// ── 0. 注入 6 家中心（瑞金已建目录） ──
console.log(`▶ 0. 视口 ${W}x${H}，注入中心配置`);
await login('shilei', '123456', true);
await page.evaluate(() => {
  const seed = {
    files: [],
    submissions: [],
    submissionSchedule: [],
    catalogs: [
      { id: 'cat-b0', kind: 'site', name: 'ON101CLCT06-SITE TMF —上海瑞金医院', projectNo: 'ON101CLCT06', center: '上海瑞金医院', creator: '石磊', createDate: '2026-08-01', updateDate: '2026-08-01', size: '0KB', status: '未完成' },
    ],
    craMap: {
      'ON101CLCT06|上海瑞金医院': '张兰',
      'ON101CLCT06|北京协和医院': '李华',
      'ON101CLCT06|江苏大学附属医院': '王金',
      'ON101CLCT06|上海华山医院': '张兰',
      'ON101CLCT06|广州中山医院': '李华',
      'ON101CLCT06|深圳南山医院': '王金',
    },
  };
  localStorage.setItem('clinx-data-v2', JSON.stringify(seed));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(500);

// ── 1. SITE 弹窗默认单项目表单 + 中心默认全选 ──
console.log('▶ 1. SITE 创建目录：表单模式 + 中心默认全选');
await navTo('SITE TMF');
assert(await clickText('创建目录'), '打开目录创建弹窗');
await sleep(700);
let ds = await dialogState();
assert(ds && !ds.hasTable, 'SITE 弹窗为表单（无表格行）');
assert(ds.sectionCount === 1, '默认仅 1 个项目区块');
assert(ds.inputs.some((i) => i.ph === '请输入项目编号'), '项目编号为纯输入框');
await setDialogInput(0, '请输入项目编号', 'ON101CLCT06');
await sleep(400);
ds = await dialogState();
assert(ds.inputs.some((i) => i.ph === '请输入文件夹名称' && i.value === 'ON101CLCT06-SITE TMF'), '文件夹名称自动跟随编号生成');
assert(ds.chips.length === 6, `中心芯片 6 家（实际 ${ds.chips.length}）`);
const rj = ds.chips.find((c) => c.text.includes('上海瑞金医院'));
assert(rj && rj.built && !rj.checked, '瑞金医院标「已建目录」且默认不勾');
assert(ds.chips.filter((c) => c.checked).length === 5, '其余 5 家默认全选');
const allCb = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const l = [...dlg.querySelectorAll('label')].find((x) => x.textContent.trim().includes('全选'));
  return l ? l.querySelector('input').checked : null;
});
assert(allCb === true, '标题行「全选」勾选框为选中态');
await page.screenshot({ path: `${SHOTS}${SHOT_BASE}-site-form-single-${W}x${H}.png` });
console.log(`  📸 ${SHOT_BASE}-site-form-single-${W}x${H}.png`);

// ── 2. 上传 RJQM → 右栏预览「将下发到 5 家中心」 ──
console.log('▶ 2. 上传 RJQM → 预览下发摘要');
await uploadForSection(0, RJQM);
ds = await dialogState();
assert(ds.asideText && ds.asideText.includes('一级 13 个 · 二级 20 个'), '右栏计数 一级13/二级20');
assert(ds.asideText.includes('将下发到 5 家中心'), '摘要「将下发到 5 家中心」');
const nameLines = ds.asideText.match(/ON101CLCT06-SITE TMF —/g) || [];
assert(nameLines.length === 5, `逐中心最终名称 5 条（实际 ${nameLines.length}）`);
await page.screenshot({ path: `${SHOTS}${SHOT_BASE + 1}-site-preview-5centers-${W}x${H}.png` });
console.log(`  📸 ${SHOT_BASE + 1}-site-preview-5centers-${W}x${H}.png`);

// ── 3. 取消 2 家勾选 → 摘要实时变 3 家 ──
console.log('▶ 3. 取消 2 家勾选 → 摘要实时 3 家');
assert(await chipClick('上海华山医院'), '取消勾选华山');
await sleep(300);
assert(await chipClick('广州中山医院'), '取消勾选中山');
await sleep(400);
ds = await dialogState();
assert(ds.asideText.includes('将下发到 3 家中心'), '摘要实时变 3 家中心');
assert((ds.asideText.match(/ON101CLCT06-SITE TMF —/g) || []).length === 3, '最终名称同步减为 3 条');
await chipClick('上海华山医院');
await sleep(200);
await chipClick('广州中山医院');
await sleep(400);
ds = await dialogState();
assert(ds.asideText.includes('将下发到 5 家中心'), '重新勾回 5 家');

// ── 4. 确认创建 → 落库 5 目录各 33 文件夹 ──
console.log('▶ 4. 确认创建 → 落库校验');
assert(await clickText('确认创建', '[role="dialog"]'), '点击「确认创建」');
await sleep(900);
let data = await readData();
const cat101 = (data.catalogs || []).filter((c) => c.kind === 'site' && c.projectNo === 'ON101CLCT06');
assert(cat101.length === 6, `ON101 共 6 个 SITE 目录（1 已有 + 5 新建，实际 ${cat101.length}）`);
const newCats = cat101.filter((c) => c.id !== 'cat-b0');
assert(newCats.length === 5, '新建 5 个目录');
const folderCount = (catId) => (data.files || []).filter((f) => f.kind === 'folder' && f.folderId === catId).length;
assert(newCats.every((c) => folderCount(c.id) === 33), `每个新目录 33 个文件夹（实际 ${newCats.map((c) => folderCount(c.id))}）`);
assert(newCats.every((c) => c.name.startsWith('ON101CLCT06-SITE TMF —')), '目录名 = 基础名 + —中心名');

// ── 5. ＋添加项目 → 双区块各自上传各自落库 ──
console.log('▶ 5. 双项目区块');
assert(await clickText('创建目录'), '再次打开目录创建弹窗');
await sleep(700);
assert(await clickText('添加项目', '[role="dialog"]'), '点击「＋添加项目」');
await sleep(500);
ds = await dialogState();
assert(ds.sectionCount === 2, '出现第二个项目区块');
await setDialogInput(0, '请输入项目编号', 'ON201CLCT06');
await sleep(400);
ds = await dialogState();
assert(ds.chipsPerSection[0].length === 3 && ds.chipsPerSection[0].every((c) => c.checked), `ON201 默认全选 3 家账号中心（实际 ${ds.chipsPerSection[0].length} 家）`);
await uploadForSection(0, RJQM);
ds = await dialogState();
assert(ds.asideText.includes('将下发到 3 家中心'), '项目 1 预览 3 家中心');
await setDialogInput(1, '请输入项目编号', 'ON202CLCT01');
await sleep(300);
await uploadForSection(1, VARIANT);
ds = await dialogState();
assert(ds.asideText.includes('一级 2 个 · 二级 3 个'), '项目 2 预览变体 一级2/二级3（上传后自动切换预览）');
await page.screenshot({ path: `${SHOTS}${SHOT_BASE + 2}-site-two-projects-${W}x${H}.png` });
console.log(`  📸 ${SHOT_BASE + 2}-site-two-projects-${W}x${H}.png`);
assert(await clickText('确认创建', '[role="dialog"]'), '确认创建双项目');
await sleep(900);
data = await readData();
const cat201 = (data.catalogs || []).filter((c) => c.kind === 'site' && c.projectNo === 'ON201CLCT06');
const cat202 = (data.catalogs || []).filter((c) => c.kind === 'site' && c.projectNo === 'ON202CLCT01');
assert(cat201.length === 3 && cat201.every((c) => folderCount(c.id) === 33), `ON201 落库 3 目录各 33 文件夹（实际 ${cat201.map((c) => folderCount(c.id))}）`);
assert(cat202.length === 3 && cat202.every((c) => folderCount(c.id) === 5), `ON202 落库 3 目录各 5 文件夹（实际 ${cat202.map((c) => folderCount(c.id))}）`);

// ── 6. STUDY 分支回归：保持原有表格样式不动 ──
console.log('▶ 6. STUDY 分支回归（表格样式不动）');
await navTo('STUDY TMF');
assert(await clickText('创建目录'), '打开 STUDY 目录创建弹窗');
await sleep(700);
const study = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return null;
  return {
    hasTable: !!dlg.querySelector('table'),
    sectionCount: dlg.querySelectorAll('section').length,
    headers: [...dlg.querySelectorAll('th')].map((h) => h.textContent.trim()),
  };
});
assert(study && study.hasTable && study.sectionCount === 0, 'STUDY 弹窗仍为表格行（无表单区块）');
assert(study && study.headers.includes('项目编号') && study.headers.includes('导入目录') && !study.headers.includes('研究中心'), 'STUDY 表头 5 列无研究中心列');
await clickText('取消', '[role="dialog"]');
await sleep(400);

await browser.close();
console.log(`\n═══ R30 验证 (${W}x${H}): ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
