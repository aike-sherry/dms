// R32 验证：研究中心独立注册表（centers: {id,name,projectNo,cra}[]，持久化 clinx-data-v2）
// 首页「研究中心 CRA 分配」升级为「研究中心管理」（增/改/删，已建目录中心删除需确认）；
// 全系统中心数据源切换（SITE 目录创建勾选 / 双端递交矩阵中心列 / CRA 上传弹窗中心下拉）；
// 空注册表引导；目录弹窗文件夹名称小字说明；改名级联；旧数据（craMap+SITE 目录）迁移。
// DEMO_MODE=false；截图 191 起
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
/* window.confirm（删除已建目录中心）记录与应答 */
let confirmSeen = 0, confirmText = '', confirmMode = 'dismiss';
page.on('dialog', (d) => { confirmSeen++; confirmText = d.message(); (confirmMode === 'accept' ? d.accept() : d.dismiss()); });

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
/* 换账号：仅清登录态保留业务数据 */
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
/* 行内按钮：先定位含 rowText 的 tr，再点其中文字含 btnText 的按钮 */
async function clickInRow(rowText, btnText) {
  return page.evaluate(({ rowText, btnText }) => {
    const tr = [...document.querySelectorAll('tr')].find((t) => t.textContent.includes(rowText));
    if (!tr) return false;
    const btn = [...tr.querySelectorAll('button')].find((b) => b.textContent.trim().includes(btnText));
    if (btn) { btn.click(); return true; }
    return false;
  }, { rowText, btnText });
}
async function setInput(ph, value, scope = '[role="dialog"]') {
  await page.evaluate(({ ph, value, scope }) => {
    const root = document.querySelector(scope);
    const el = [...root.querySelectorAll('input')].find((i) => (i.placeholder || '').includes(ph));
    if (!el) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, { ph, value, scope });
  await sleep(250);
}
const getInput = (ph, scope = '[role="dialog"]') =>
  page.evaluate(({ ph, scope }) => {
    const root = document.querySelector(scope);
    if (!root) return null;
    const el = [...root.querySelectorAll('input')].find((i) => (i.placeholder || '').includes(ph));
    return el ? { value: el.value, disabled: el.disabled } : null;
  }, { ph, scope });
/* 弹窗内原生 select（ToolbarSelect）设值 */
async function setDialogSelect(value) {
  return page.evaluate((value) => {
    const sel = document.querySelector('[role="dialog"] select');
    if (!sel) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, value);
}
/* 日历面板选日（data-day 精确匹配） */
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
const bodyHas = (t) => page.evaluate((t) => document.body.innerText.includes(t), t);
const matrixHead = () =>
  page.evaluate(() => {
    const t = document.querySelectorAll('table')[0];
    return t ? t.querySelector('thead').innerText : '';
  });
/* SITE 目录弹窗中心芯片（label 文本列表，排除「全选」行） */
const siteChips = () =>
  page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return null;
    return [...dlg.querySelectorAll('label')]
      .filter((l) => l.querySelector('input[type=checkbox]'))
      .map((l) => l.textContent.trim())
      .filter((t) => t !== '全选');
  });
async function addCenter(projectNo, name, cra) {
  await clickText('新增中心');
  await sleep(500);
  await setInput('请输入项目编号', projectNo);
  await setInput('请输入研究中心名称', name);
  if (cra) await setDialogSelect(cra);
  await clickText('确认新增', '[role="dialog"]');
  await sleep(600);
}

// ═══════════ 1. 空白环境：注册表为空，各入口引导 ═══════════
console.log('▶ 1. 空白环境引导断言');
await login('shilei', '123456', true);
assert(await bodyHas('研究中心管理'), '首页卡片升级为「研究中心管理」');
assert(await bodyHas('暂无研究中心，点击右上角「新增中心」添加'), '空注册表：管理表空态文案');
assert(!(await bodyHas('研究中心 CRA 分配')), '旧「研究中心 CRA 分配」已移除');
await navTo('SITE TMF');
assert(await clickText('创建目录'), '打开 SITE 目录创建弹窗');
await sleep(600);
assert(await page.evaluate(() => !!document.querySelector('[role="dialog"]') && document.querySelector('[role="dialog"]').innerText.includes('请先在首页配置研究中心')), '空注册表：SITE 弹窗引导文案');
assert((await siteChips()).length === 0, '空注册表：无任何中心芯片');
assert(await page.evaluate(() => document.querySelector('[role="dialog"]').innerText.includes('各中心最终名称 = 该名称 + —中心名')), '文件夹名称 label 下小字说明');
assert((await getInput('请输入文件夹名称'))?.value === '', '编号为空时文件夹名称保持空');
await setInput('请输入项目编号', 'ON101CL103');
assert((await getInput('请输入文件夹名称'))?.value === 'ON101CL103-SITE TMF', '输入编号后名称跟随生成');
await setInput('请输入项目编号', '');
assert((await getInput('请输入文件夹名称'))?.value === '', '清空编号后名称回到空');
await clickText('取消', '[role="dialog"]');
await sleep(400);
await navTo('SUBMISSION');
const head0 = await matrixHead();
assert(!head0.includes('瑞金医院') && !head0.includes('中山医院'), '空注册表：矩阵无固定中心列');
assert(await bodyHas('请先在首页「研究中心管理」中添加'), '空注册表：矩阵配置引导');

// ═══════════ 2. 首页 UI 新增两个中心 ═══════════
console.log('▶ 2. 新增中心（UI 操作）');
await navTo('HOME');
await addCenter('ON101CL103', '上海瑞金医院', '王金');
await addCenter('ON101CL103', '上海华山医院', '张兰');
let data = await readData();
assert((data.centers || []).length === 2, `注册表落库 2 条（实际 ${(data.centers || []).length}）`);
assert(data.centers?.some((c) => c.name === '上海瑞金医院' && c.projectNo === 'ON101CL103' && c.cra === '王金'), '瑞金行字段正确（含 CRA 王金）');
assert(data.centers?.some((c) => c.name === '上海华山医院' && c.cra === '张兰'), '华山行字段正确（含 CRA 张兰）');
/* 重复添加拦截 */
await addCenter('ON101CL103', '上海瑞金医院', '王金');
assert(await bodyHas('该中心已存在'), '重复中心 toast 拦截');
data = await readData();
assert((data.centers || []).length === 2, '重复添加未落库');
await clickText('取消', '[role="dialog"]');
await sleep(400);
await page.evaluate(() => {
  [...document.querySelectorAll('h2, h3, div')].find((d) => d.children.length === 0 && d.textContent.trim() === '研究中心管理')?.scrollIntoView({ block: 'center' });
});
await sleep(300);
await page.screenshot({ path: SHOTS + '191-home-center-mgmt.png' });
console.log('  📸 191-home-center-mgmt.png（首页研究中心管理）');

// ═══════════ 3. SITE 目录弹窗：注册表芯片可勾 ═══════════
console.log('▶ 3. SITE 目录创建勾选列表');
await navTo('SITE TMF');
assert(await clickText('创建目录'), '再次打开 SITE 弹窗');
await sleep(600);
await setInput('请输入项目编号', 'ON101CL103');
const chips = await siteChips();
assert(chips.length === 2 && chips.some((c) => c.includes('上海瑞金医院')) && chips.some((c) => c.includes('上海华山医院')), `芯片=注册表 2 中心（实际 ${chips.join('|')}）`);
assert(await page.evaluate(() => document.querySelector('[role="dialog"]').innerText.includes('已选 2/2')), '未建目录中心默认全选（已选 2/2）');
await page.screenshot({ path: SHOTS + '192-site-dialog-centers.png' });
console.log('  📸 192-site-dialog-centers.png（目录创建勾选列表）');
await clickText('取消', '[role="dialog"]');
await sleep(400);

// ═══════════ 4. PM 递交矩阵动态中心列 ═══════════
console.log('▶ 4. PM 递交矩阵动态列');
await navTo('SUBMISSION');
const head1 = await matrixHead();
assert(head1.includes('上海华山医院') && head1.includes('上海瑞金医院'), '矩阵中心列=注册表（动态渲染）');
await page.screenshot({ path: SHOTS + '193-matrix-dynamic-cols.png' });
console.log('  📸 193-matrix-dynamic-cols.png（PM 动态矩阵）');
/* 注入一条已发布递交+矩阵行（供执行端录入测试） */
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('clinx-data-v2'));
  d.submissions.push({ id: 'sub-t1', topic: 'R32 验证递交', fileName: '方案.pdf', kind: 'pdf', projectNo: 'ON101CL103', uploadDate: '2026-08-13', size: '10KB', published: true, deadline: '2026-09-30' });
  d.submissionSchedule.push({ id: 'sub-t1', topic: 'R32 验证递交', publishDate: '2026-08-13', deadline: '2026-09-30', dates: {} });
  localStorage.setItem('clinx-data-v2', JSON.stringify(d));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(600);

// ═══════════ 5. 执行端：仅本中心列可编辑 + 上传弹窗下拉 ═══════════
console.log('▶ 5. 执行端（张兰 / 上海瑞金医院）');
await relogin('zhanglan', '123456');
await navTo('SUBMISSION');
assert(await clickText('更新'), '打开递交日期编辑');
await sleep(500);
const editInfo = await page.evaluate(() => {
  const t = document.querySelectorAll('table')[0];
  const row = t?.querySelector('tbody tr');
  if (!row) return null;
  const btns = [...row.querySelectorAll('button')].filter((b) => b.textContent.includes('选择日期') || /\d{4}-\d{2}-\d{2}/.test(b.textContent));
  const readonlyTitles = [...row.querySelectorAll('span[title]')].map((s) => s.getAttribute('title'));
  return { editable: btns.length, readonlyTitles };
});
assert(editInfo && editInfo.editable === 1, `编辑态仅 1 列可编辑（本中心），实际 ${editInfo?.editable}`);
assert(editInfo && editInfo.readonlyTitles.includes('仅本中心可录入'), '他中心列为只读（仅本中心可录入）');
await page.evaluate(() => {
  const t = document.querySelectorAll('table')[0];
  [...t.querySelector('tbody tr').querySelectorAll('button')].find((b) => b.textContent.includes('选择日期'))?.click();
});
await sleep(600);
assert(await pickDate(2026, 8, 13), '瑞金列选择 2026-08-13');
await sleep(400);
await page.screenshot({ path: SHOTS + '194-ex-matrix-edit.png' });
console.log('  📸 194-ex-matrix-edit.png（执行端本中心列编辑）');
assert(await clickText('保存'), '保存递交日期');
await sleep(700);
data = await readData();
assert(data.submissionSchedule?.[0]?.dates?.['上海瑞金医院'] === '2026-08-13', `落库 dates[上海瑞金医院]=2026-08-13（实际 ${data.submissionSchedule?.[0]?.dates?.['上海瑞金医院']}）`);
await navTo('TRANSFER');
assert(await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '上传');
  if (btn) { btn.click(); return true; }
  return false;
}), '打开 CRA 上传弹窗');
await sleep(600);
const uploadCenters = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return null;
  const sels = [...dlg.querySelectorAll('select')];
  const centerSel = sels.find((s) => [...s.options].some((o) => o.value.includes('医院')));
  return centerSel ? [...centerSel.options].map((o) => o.value) : [];
});
assert(uploadCenters && uploadCenters.length === 2 && uploadCenters.includes('上海瑞金医院') && uploadCenters.includes('上海华山医院'), `上传弹窗中心下拉=注册表 2 家（实际 ${uploadCenters?.join('|')}）`);
await clickText('取消', '[role="dialog"]');
await sleep(400);

// ═══════════ 6. 改名级联（已建目录中心） ═══════════
console.log('▶ 6. 改名级联');
await relogin('shilei', '123456');
/* 注入瑞金 SITE 目录 + 归档文件（中心变为「已建目录」） */
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('clinx-data-v2'));
  d.catalogs.push({ id: 'cat-sr1', kind: 'site', name: 'ON101CLCT09–SITE TMF —上海瑞金医院', projectNo: 'ON101CL103', center: '上海瑞金医院', creator: '石磊', createDate: '2026-08-13', updateDate: '2026-08-13', size: '0KB', status: '未完成' });
  d.files.push({ id: 'f-r32-1', name: 'ON101–伦理批件–上海瑞金医院–20260801', kind: 'pdf', projectNo: 'ON101CL103', center: '上海瑞金医院', uploader: '张兰', uploadDate: '2026-08-01', size: '100KB', status: 'archived', folderId: 'cat-sr1' });
  localStorage.setItem('clinx-data-v2', JSON.stringify(d));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(600);
await navTo('HOME');
assert(await bodyHas('已建目录'), '首页中心行显示「已建目录」徽标');
assert(await clickInRow('上海瑞金医院', '编辑'), '打开瑞金行编辑');
await sleep(500);
assert((await getInput('请输入项目编号'))?.disabled === true, '已建目录中心项目编号锁定');
await setInput('请输入研究中心名称', '上海瑞金总院');
assert(await clickText('确认保存', '[role="dialog"]'), '确认保存改名');
await sleep(700);
data = await readData();
assert(data.centers?.some((c) => c.name === '上海瑞金总院'), '注册表名称已更新');
const catSr = data.catalogs?.find((c) => c.id === 'cat-sr1');
assert(catSr && catSr.center === '上海瑞金总院' && catSr.name.endsWith('—上海瑞金总院'), `级联：目录 center+名称后缀同步（实际 ${catSr?.name}）`);
assert(data.files?.find((f) => f.id === 'f-r32-1')?.center === '上海瑞金总院', '级联：归档文件 center 同步');
const dates = data.submissionSchedule?.[0]?.dates || {};
assert(dates['上海瑞金总院'] === '2026-08-13' && !('上海瑞金医院' in dates), '级联：递交矩阵日期键平移且数据保留');
await navTo('SUBMISSION');
const head2 = await matrixHead();
assert(head2.includes('上海瑞金总院') && !head2.includes('上海瑞金医院'), '矩阵列名同步为新名');
assert(await page.evaluate(() => document.querySelectorAll('table')[0]?.querySelector('tbody')?.innerText.includes('2026-08-13')), '矩阵单元格日期保留显示');
await page.screenshot({ path: SHOTS + '195-matrix-renamed.png' });
console.log('  📸 195-matrix-renamed.png（改名后矩阵）');

// ═══════════ 7. 删除：未建目录直删；已建目录确认 ═══════════
console.log('▶ 7. 删除中心');
await navTo('HOME');
confirmSeen = 0;
assert(await clickInRow('上海华山医院', '删除'), '删除华山（未建目录）');
await sleep(600);
assert(confirmSeen === 0, '未建目录中心删除无确认弹窗');
data = await readData();
assert((data.centers || []).length === 1 && data.centers[0].name === '上海瑞金总院', '华山已从注册表移除');
confirmMode = 'dismiss'; confirmSeen = 0;
assert(await clickInRow('上海瑞金总院', '删除'), '删除瑞金总院（已建目录）');
await sleep(500);
assert(confirmSeen === 1 && confirmText.includes('已创建 SITE TMF 目录'), '已建目录中心删除弹确认提示');
data = await readData();
assert((data.centers || []).length === 1, '取消确认后中心保留');
confirmMode = 'accept';
assert(await clickInRow('上海瑞金总院', '删除'), '再次删除并确认');
await sleep(600);
data = await readData();
assert((data.centers || []).length === 0, '确认后注册表清空');
assert(data.catalogs?.some((c) => c.id === 'cat-sr1'), '已建目录与文件保留（仅移除注册表配置）');
assert(await bodyHas('暂无研究中心'), '注册表空态恢复');

// ═══════════ 8. 旧数据迁移（craMap + 已有 SITE 目录 → 注册表） ═══════════
console.log('▶ 8. 旧数据迁移');
await page.evaluate(() => {
  localStorage.setItem('clinx-data-v2', JSON.stringify({
    files: [],
    catalogs: [
      { id: 'cat-old1', kind: 'site', name: 'ON102CLCT01–SITE TMF —北京协和医院', projectNo: 'ON102CL01', center: '北京协和医院', creator: '石磊', createDate: '2026-03-08', updateDate: '2026-06-15', size: '0KB', status: '未完成' },
    ],
    submissions: [],
    submissionSchedule: [],
    craMap: { 'ON102CL01|北京协和医院': '李华', 'ON101CL103|江苏大学附属医院': '王金' },
  }));
});
await page.reload({ waitUntil: 'networkidle0' });
await sleep(700);
data = await readData();
assert((data.centers || []).length === 2, `迁移派生 2 中心（去重后，实际 ${(data.centers || []).length}）`);
assert(data.centers?.some((c) => c.name === '北京协和医院' && c.projectNo === 'ON102CL01' && c.cra === '李华'), 'craMap 键拆分+cra 迁移（北京协和/李华）');
assert(data.centers?.some((c) => c.name === '江苏大学附属医院' && c.projectNo === 'ON101CL103' && c.cra === '王金'), 'craMap 迁移（江苏大学附属/王金）');
await navTo('SITE TMF');
assert(await clickText('创建目录'), '迁移后打开 SITE 弹窗');
await sleep(600);
await setInput('请输入项目编号', 'ON102CL01');
const chips2 = await siteChips();
assert(chips2.length === 1 && chips2[0].includes('北京协和医院') && chips2[0].includes('已建目录'), `迁移中心参与勾选且已建目录标记（实际 ${chips2.join('|')}）`);
await page.screenshot({ path: SHOTS + '196-migrated-site-dialog.png' });
console.log('  📸 196-migrated-site-dialog.png（迁移后勾选列表）');
await clickText('取消', '[role="dialog"]');

await browser.close();
console.log(`\n═══ R32 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
