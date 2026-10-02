// R41 登录页回调 + 应用内顶栏字标统一验证
//   A-C 登录页三视口：1906×907 / 1366×768 零滚动硬指标（|scrollHeight-innerHeight|≤2）、无横向溢出、
//        BrandMark 描边字标+角框+弧线存在、主标题 ≤32px 量级；390×844 可滚动不崩
//   D 登录回归：错误密码拦截、shilei/123456 成功
//   E 顶栏：PM HOME / CRA（zhanglan）/ admin 三端各一张，新字标+时间显示存在
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
/* 登录页布局探针 */
const loginProbe = () => page.evaluate(() => {
  const cs = (el, prop) => (el ? getComputedStyle(el)[prop] : null);
  const h1 = document.querySelector('h1');
  const headerMark = document.querySelector('header svg[role="img"]');
  const cardMark = document.querySelector('main svg[role="img"]');
  const markInfo = (svg) => {
    if (!svg) return null;
    const paths = [...svg.querySelectorAll('path')];
    const text = svg.querySelector('text');
    return {
      paths: paths.length,
      textStroke: text?.getAttribute('stroke')?.includes('url(#brandMarkGrad)') ?? false,
      textContent: text?.textContent ?? '',
      arcGrad: paths.every((p) => (p.getAttribute('stroke') ?? '').includes('url(#brandMarkGrad)')),
    };
  };
  const inputWrap = document.querySelector('main input')?.closest('div');
  const submitBtn = [...document.querySelectorAll('button')].find((b) => b.type === 'submit');
  const cards = [...document.querySelectorAll('main ul li')];
  return {
    text: document.body.innerText,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    scrollGap: document.documentElement.scrollHeight - window.innerHeight,
    h1FontSize: cs(h1, 'fontSize'),
    h1FontWeight: cs(h1, 'fontWeight'),
    headerMark: markInfo(headerMark),
    cardMark: markInfo(cardMark),
    inputRadius: cs(inputWrap, 'borderRadius'),
    btnBg: cs(submitBtn, 'backgroundImage'),
    btnRadius: cs(submitBtn, 'borderRadius'),
    cardCount: cards.length,
    cardIconSize: cards[0] ? cs(cards[0].querySelector('div'), 'height') : null,
    docFlow: !!document.querySelector('#loginFlowGrad'),
    docFlowVisible: (() => {
      const el = document.querySelector('#loginFlowGrad')?.closest('div[aria-hidden]');
      return el ? getComputedStyle(el).display !== 'none' : false;
    })(),
    placeholders: [...document.querySelectorAll('main input')].map((i) => i.placeholder),
    demoHint: document.body.innerText.includes('演示账号（密码均为 123456）'),
  };
});
const assertMark = (m, label) => {
  assert(!!m, `${label} BrandMark 存在`);
  assert(m?.textStroke === true && m?.textContent === 'CLINI X TRIALS', `${label} 描边空心渐变字标（CLINI X TRIALS）`);
  assert(m?.paths === 3 && m?.arcGrad === true, `${label} 对角角框×2 + 微笑弧线（渐变描边）`);
};

// ═══════════ A. 1906×907 ═══════════
console.log('▶ A. 1906×907 零滚动');
await gotoLogin();
{
  const p = await loginProbe();
  assert(Math.abs(p.scrollGap) <= 2, `整页一屏零滚动（scrollHeight-innerHeight=${p.scrollGap}px）`);
  assert(p.overflowX <= 1, `无横向溢出（超出 ${p.overflowX}px）`);
  assertMark(p.headerMark, 'header');
  assertMark(p.cardMark, '登录卡');
  assert(Number.parseFloat(p.h1FontSize) <= 32, `主标题降档 ≤32px（实际 ${p.h1FontSize}）`);
  assert(Number.parseInt(p.h1FontWeight) === 700, `主标题 font-bold（实际 ${p.h1FontWeight}）`);
  assert(p.cardCount === 3 && p.cardIconSize === '36px', `特性卡 3 张紧凑（图标 ${p.cardIconSize}）`);
  assert(p.inputRadius === '9999px' && p.btnRadius === '9999px', '胶囊输入框/按钮保留');
  assert(p.btnBg.includes('linear-gradient') && p.btnBg.includes('167, 139, 250'), '按钮左紫右 teal 渐变保留');
  assert(p.docFlow && p.docFlowVisible, 'DocFlowVisual 保留可见');
  assert(p.demoHint, '演示账号提示保留');
  assert(p.text.includes('DOCUMENT MANAGEMENT SYSTEM'), '英文大写渐变副标题在');
}
await shot(287, 'r41-login-1906');

// ═══════════ B. 1366×768 ═══════════
console.log('▶ B. 1366×768 零滚动');
await page.setViewport({ width: 1366, height: 768 });
await gotoLogin();
{
  const p = await loginProbe();
  assert(Math.abs(p.scrollGap) <= 2, `整页一屏零滚动（scrollHeight-innerHeight=${p.scrollGap}px）`);
  assert(p.overflowX <= 1, `无横向溢出（超出 ${p.overflowX}px）`);
  assertMark(p.headerMark, 'header');
  assert(p.cardCount === 3 && p.docFlowVisible, '特性卡+DocFlow lg 显示');
  assert(Number.parseFloat(p.h1FontSize) <= 32, `主标题 ${p.h1FontSize}`);
}
await shot(288, 'r41-login-1366');

// ═══════════ C. 390×844 ═══════════
console.log('▶ C. 390×844 可滚动不崩');
await page.setViewport({ width: 390, height: 844 });
await gotoLogin();
{
  const p = await loginProbe();
  assert(p.overflowX <= 1, `无横向溢出（超出 ${p.overflowX}px）`);
  assert(p.text.includes('欢迎登录') && p.placeholders.some((x) => x && x.includes('登录密码')), '登录卡全宽可见');
  assertMark(p.headerMark, 'header');
  assert(!p.docFlowVisible, 'DocFlowVisual 窄屏隐藏');
}
await shot(289, 'r41-login-390');

// ═══════════ D. 登录回归 ═══════════
console.log('▶ D. 登录回归');
await page.setViewport({ width: 1906, height: 907 });
await gotoLogin();
{
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')];
    const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(inputs[0], 'admin'); set(inputs[1], 'wrongpwd');
    [...document.querySelectorAll('button')].find((b) => b.type === 'submit')?.click();
  });
  await sleep(600);
  assert(await page.evaluate(() => document.body.innerText.includes('账号或密码错误，请重试')), '错误密码红字拦截');
  assert(await page.evaluate(() => !sessionStorage.getItem('clinx-auth')), '拦截后不写登录态');
}
await login('shilei', '123456');
assert(await page.evaluate(() => JSON.parse(sessionStorage.getItem('clinx-auth') || '{}').role === 'pm'), 'shilei 登录成功 role=pm');

// ═══════════ E. 应用内顶栏三端 ═══════════
console.log('▶ E. 顶栏（PM / CRA / admin）');
const headerProbe = () => page.evaluate(() => {
  const header = document.querySelector('header');
  const mark = header?.querySelector('svg[role="img"]');
  const text = mark?.querySelector('text');
  const vis = header?.innerText ?? '';
  return {
    mark: !!mark && text?.getAttribute('stroke')?.includes('url(#brandMarkGrad)') && text?.textContent === 'CLINI X TRIALS',
    paths: mark ? mark.querySelectorAll('path').length : 0,
    sysName: vis.includes('研究文件管理系统'),
    enSub: vis.includes('DOCUMENT MANAGEMENT SYSTEM'),
    clock: /\d{2}:\d{2}:\d{2}/.test(vis),
  };
});
{
  const h = await headerProbe();
  assert(h.mark && h.paths === 3, 'PM 端顶栏 BrandMark 字标（描边渐变+角框+弧线）在');
  assert(h.sysName && h.enSub, 'PM 端中文名+英文大写副标题在');
  assert(h.clock, 'PM 端大时钟保留');
}
await shot(290, 'r41-header-pm');
await login('zhanglan', '123456');
{
  const h = await headerProbe();
  assert(h.mark && h.paths === 3 && h.clock, 'CRA 端顶栏字标+时钟在');
}
await shot(291, 'r41-header-cra');
await login('admin', '123456');
{
  const h = await headerProbe();
  assert(h.mark && h.paths === 3 && h.clock, 'admin 端顶栏字标+时钟在');
}
await shot(292, 'r41-header-admin');

await browser.close();
console.log(`\n═══ R41 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
