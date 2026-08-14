// R33 补拍：STUDY TMF 目录创建弹窗（含 STUDY 裸表模板表格）居中断言 + 截图 215
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

await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
await sleep(300);
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')];
  const set = (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set(inputs[0], 'shilei'); set(inputs[1], '123456');
  [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s/g, '') === '登录')?.click();
});
await page.waitForFunction(() => !!sessionStorage.getItem('clinx-auth'), { timeout: 8000 });
await sleep(400);

/* STUDY TMF 页 → 创建目录（STUDY 类型弹窗含裸表模板） */
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim().toUpperCase() === 'STUDY TMF')?.click();
});
await sleep(700);
const opened = await page.evaluate(() => {
  const els = [...document.querySelectorAll('button, a, [role="button"], span, div')];
  const el = els.find((e) => e.children.length === 0 && e.textContent.trim() === '创建目录')
    || els.find((e) => e.tagName === 'BUTTON' && e.textContent.trim() === '创建目录');
  if (el) { el.click(); return true; }
  return false;
});
assert(opened, '打开 STUDY 目录创建弹窗');
await sleep(700);

const res = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return null;
  const vis = (el) => el.getClientRects().length > 0;
  const cells = [...dlg.querySelectorAll('th, td')].filter(vis);
  const bad = [];
  for (const el of cells) {
    const ta = getComputedStyle(el).textAlign;
    if (ta !== 'center') bad.push(`${el.tagName}「${el.textContent.trim().slice(0, 12)}」=${ta}`);
  }
  const inputs = [...dlg.querySelectorAll('table input')].filter((i) => vis(i) && i.type !== 'checkbox');
  const badInputs = inputs.filter((i) => getComputedStyle(i).textAlign !== 'center').length;
  return { cells: cells.length, bad: bad.slice(0, 6), badCount: bad.length, inputs: inputs.length, badInputs };
});
assert(res && res.cells > 0, `STUDY 弹窗裸表存在（${res?.cells ?? 0} 个单元格）`);
if (res) {
  assert(res.badCount === 0, `STUDY 弹窗裸表全部居中${res.badCount ? `（异常：${res.bad.join('；')}）` : ''}`);
  if (res.inputs > 0) assert(res.badInputs === 0, `STUDY 弹窗表内输入框居中（${res.inputs} 个${res.badInputs ? `，异常 ${res.badInputs}` : ''}）`);
}
await page.screenshot({ path: SHOTS + '215-study-catalog-dialog.png' });
console.log('  📸 215-study-catalog-dialog.png');

await browser.close();
console.log(`\n═══ R33 补拍: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
