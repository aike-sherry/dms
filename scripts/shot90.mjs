// R37 验证：登录页视觉优化（三视口布局 + 主视觉 + 玻璃卡片）+ 登录功能回归
// DEMO_MODE=false；截图 238 起，存工作区根 shots/
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

const shot = async (pg, num, name) => {
  await pg.screenshot({ path: `${SHOTS}${num}-${name}.png` });
  console.log(`  📸 ${num}-${name}.png`);
};

/* 布局通用断言：无横向溢出 / 关键元素存在可见 */
async function layoutChecks(pg, label, { visual }) {
  const r = await pg.evaluate(() => {
    const doc = document.documentElement;
    const vis = (el) => !!el && el.getClientRects().length > 0;
    const q = (sel) => [...document.querySelectorAll(sel)];
    const watermark = q('div').find((d) => d.textContent === 'eTMF' && d.getAttribute('aria-hidden') !== null);
    const card = q('div').find((d) => d.textContent.includes('欢迎登录') && d.className.includes('backdrop-blur-xl'));
    const flowSvg = q('svg').find((s) => s.innerHTML.includes('loginFlowGrad'));
    const floaters = q('.login-float').filter(vis);
    const badges = q('span').filter((s) => ['上传', '审核', '归档'].includes(s.textContent.trim()) && s.className.includes('rounded-full') && vis(s));
    return {
      overflowX: doc.scrollWidth - doc.clientWidth,
      scrollY: doc.scrollHeight - window.innerHeight,
      watermark: vis(watermark),
      cardW: card ? Math.round(card.getBoundingClientRect().width) : 0,
      flowSvg: vis(flowSvg),
      floaters: floaters.length,
      badges: badges.length,
      logo: vis(document.querySelector('header img')),
      grid: !!q('div').find((d) => (d.getAttribute('style') || '').includes('44px 44px')),
    };
  });
  assert(r.overflowX <= 0, `${label}：无横向溢出（overflowX=${r.overflowX}）`);
  assert(r.logo, `${label}：顶部 LOGO 可见`);
  assert(r.grid, `${label}：背景网格纹理存在`);
  assert(r.cardW > 0, `${label}：登录卡渲染（宽 ${r.cardW}px）`);
  if (visual) {
    assert(r.watermark, `${label}：描边水印可见`);
    assert(r.flowSvg, `${label}：文档流转动线 SVG 可见`);
    assert(r.floaters >= 3, `${label}：浮动文档卡 ${r.floaters} 个（≥3）`);
    assert(r.badges === 3, `${label}：上传/审核/归档 节点标签 ×3`);
  } else {
    assert(!r.flowSvg, `${label}：主视觉已精简隐藏（窄屏）`);
  }
  return r;
}

// ═══════════ 1. 三视口截图 + 布局断言 ═══════════
console.log('▶ 1. 三视口布局');
const pg1 = await browser.newPage();
pg1.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await pg1.setViewport({ width: 1906, height: 907 });
await pg1.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
await sleep(1400); // 入场动画播完
let r = await layoutChecks(pg1, '1906×907', { visual: true });
assert(r.cardW === 440, `1906×907：登录卡加宽至 440px（实际 ${r.cardW}）`);
await shot(pg1, 238, 'login-1906');

await pg1.setViewport({ width: 1366, height: 768 });
await sleep(500);
r = await layoutChecks(pg1, '1366×768', { visual: true });
assert(r.scrollY <= 60, `1366×768：不滚动或仅轻微滚动（超出 ${r.scrollY}px ≤60）`);
await shot(pg1, 239, 'login-1366');

await pg1.setViewport({ width: 390, height: 844 });
await sleep(500);
r = await layoutChecks(pg1, '390×844', { visual: false });
assert(r.cardW <= 358 && r.cardW >= 300, `390×844：卡片全宽居中（实际 ${r.cardW}px）`);
await shot(pg1, 240, 'login-390');

// ═══════════ 2. 登录功能回归 ═══════════
console.log('▶ 2. 登录功能回归');
const pg2 = await browser.newPage();
pg2.on('pageerror', (e) => console.log('  [pageerror2]', e.message));
await pg2.setViewport({ width: 1517, height: 800 });
await pg2.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
await sleep(600);
const fill = (pg, u, p) => pg.evaluate(({ u, p }) => {
  const inputs = [...document.querySelectorAll('input')];
  const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  set(inputs[0], u); set(inputs[1], p);
  [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s/g, '') === '登录')?.click();
}, { u, p });

/* 错误密码 → 提示 */
await fill(pg2, 'shilei', 'wrongpass');
await sleep(600);
assert(await pg2.evaluate(() => document.body.innerText.includes('账号或密码错误，请重试')), '错误密码提示正常');
assert(!(await pg2.evaluate(() => !!sessionStorage.getItem('clinx-auth'))), '错误密码未写入登录态');

/* 正确登录 → PM 首页 */
await fill(pg2, 'shilei', '123456');
await pg2.waitForFunction(() => !!sessionStorage.getItem('clinx-auth'), { timeout: 8000 });
await sleep(900);
const auth = await pg2.evaluate(() => JSON.parse(sessionStorage.getItem('clinx-auth')));
assert(auth.role === 'pm', `shilei/123456 登录成功（clinx-auth=${JSON.stringify(auth)}）`);
assert(await pg2.evaluate(() => document.body.innerText.includes('HOME') && document.body.innerText.includes('研究文件管理系统')), '跳转 PM 端首页');
await shot(pg2, 241, 'login-success-pm-home');

await browser.close();
console.log(`\n═══ R37 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
