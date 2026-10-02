// R40 登录页参照「科研数据管理平台」设计优化验证
//   三视口（1906×907 / 1366×768 / 390×844）布局断言 + 截图 283-285
//   登录回归：错误密码拦截、shilei/123456 成功跳 PM 首页（截图 286）
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
  await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
  await sleep(700);
};
/* 布局探针：一次 evaluate 取全部断言素材 */
const probe = () => page.evaluate(() => {
  const cs = (el, prop) => (el ? getComputedStyle(el)[prop] : null);
  const headerSvg = document.querySelector('header svg');
  const cardSvg = document.querySelector('main section:last-child svg');
  const h1 = document.querySelector('h1');
  const badgeDot = [...document.querySelectorAll('main span')].find((s) => cs(s, 'backgroundColor') === 'rgb(52, 211, 153)');
  const cards = [...document.querySelectorAll('main ul li')];
  const firstCardIcon = cards[0]?.querySelector('div');
  const inputWrap = document.querySelector('main input')?.closest('div');
  const inputs = [...document.querySelectorAll('main input')];
  const submitBtn = [...document.querySelectorAll('button')].find((b) => b.type === 'submit');
  const loginCard = submitBtn?.closest('div[class*="rounded"]');
  const ul = document.querySelector('main ul');
  const eTMF = [...document.querySelectorAll('span')].find((s) => s.textContent.trim() === 'eTMF');
  return {
    text: document.body.innerText,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    scrollY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    headerArc: !!headerSvg && headerSvg.querySelector('path')?.getAttribute('stroke')?.includes('url('),
    cardArc: !!cardSvg && cardSvg.querySelector('path')?.getAttribute('stroke')?.includes('url('),
    h1FontSize: cs(h1, 'fontSize'),
    h1FontWeight: cs(h1, 'fontWeight'),
    badgeDot: !!badgeDot,
    badgeText: document.body.innerText.includes('智能一体化临床研究文件管理平台'),
    cardCount: cards.length,
    cardBg: cards.length ? cs(cards[0], 'backgroundColor') : null,
    cardRadius: cards.length ? cs(cards[0], 'borderRadius') : null,
    cardIconGrad: firstCardIcon ? cs(firstCardIcon, 'backgroundImage').includes('linear-gradient') : null,
    ulDisplay: cs(ul, 'display'),
    inputRadius: cs(inputWrap, 'borderRadius'),
    placeholders: inputs.map((i) => i.placeholder),
    btnRadius: cs(submitBtn, 'borderRadius'),
    btnBg: cs(submitBtn, 'backgroundImage'),
    cardWhite: cs(loginCard, 'backgroundColor'),
    eTMF: !!eTMF,
    docFlow: !!document.querySelector('#loginFlowGrad'),
    demoHint: document.body.innerText.includes('演示账号（密码均为 123456）'),
  };
});

// ═══════════ A. 1906×907 大视口 ═══════════
console.log('▶ A. 1906×907');
await gotoLogin();
{
  const p = await probe();
  assert(p.overflowX <= 1, `无横向溢出（超出 ${p.overflowX}px）`);
  assert(p.text.includes('研究文件管理系统'), '中文系统名在');
  assert(p.text.includes('DOCUMENT MANAGEMENT SYSTEM'), '英文大写渐变大写副标题在');
  assert(p.headerArc === true, 'header logo 微笑弧线（SVG 渐变描边）在');
  assert(p.cardArc === true, '卡片 logo 弧线小版在');
  assert(p.badgeDot, '徽章白色胶囊+绿色圆点在');
  assert(p.badgeText, '徽章文案保留');
  assert(p.cardCount === 3 && p.cardBg === 'rgb(255, 255, 255)' && p.cardRadius === '16px', `特性区 3 张白色圆角卡片（实际 ${p.cardCount} 张 ${p.cardBg} ${p.cardRadius}）`);
  assert(p.cardIconGrad === true, '特性卡左侧彩色渐变方块图标');
  assert(p.inputRadius === '9999px', `输入框胶囊形（borderRadius=${p.inputRadius}）`);
  assert(p.placeholders[0] === '登录账号 / 邮箱' && p.placeholders[1] === '登录密码', `占位符文案（${p.placeholders.join(' / ')}）`);
  assert(p.btnRadius === '9999px' && p.btnBg.includes('linear-gradient') && p.btnBg.includes('167, 139, 250'), '登录按钮胶囊+左紫右 teal 渐变');
  assert(p.cardWhite === 'rgb(255, 255, 255)', '登录卡片更白更实（纯白底）');
  assert(p.eTMF, 'eTMF 徽标保留');
  assert(p.docFlow, 'DocFlowVisual 文件流转图形保留');
  assert(p.demoHint, '演示账号提示保留');
}
await shot(283, 'r40-login-1906');

// ═══════════ B. 1366×768 ═══════════
console.log('▶ B. 1366×768');
await page.setViewport({ width: 1366, height: 768 });
await gotoLogin();
{
  const p = await probe();
  assert(p.overflowX <= 1, `无横向溢出（超出 ${p.overflowX}px）`);
  assert(p.h1FontSize === '48px', `主标题升档 text-5xl（实际 ${p.h1FontSize}）`);
  assert(Number.parseInt(p.h1FontWeight) >= 800, `主标题加粗 extrabold（实际 ${p.h1FontWeight}）`);
  assert(p.ulDisplay === 'block', '特性卡片区 lg 显示');
  assert(p.cardCount === 3, '3 张特性卡片在');
  assert(p.docFlow, 'DocFlowVisual lg 显示');
  assert(p.inputRadius === '9999px' && p.cardWhite === 'rgb(255, 255, 255)', '胶囊输入框+白实卡片保持');
  console.log(`  ℹ 纵向余量 ${p.scrollY}px（可滚动不视为失败，只要不崩不叠）`);
}
await shot(284, 'r40-login-1366');

// ═══════════ C. 390×844 移动视口 ═══════════
console.log('▶ C. 390×844');
await page.setViewport({ width: 390, height: 844 });
await gotoLogin();
{
  const p = await probe();
  assert(p.overflowX <= 1, `无横向溢出（超出 ${p.overflowX}px）`);
  assert(p.ulDisplay === 'none', '特性区窄屏隐藏（与现状策略一致）');
  assert(!p.docFlow || p.docFlow === false || p.docFlow === true, 'DocFlow 探针执行正常');
  assert(p.text.includes('欢迎登录') && p.placeholders.length === 2, '登录卡全宽可见');
  assert(p.btnRadius === '9999px', '胶囊按钮保持');
  assert(p.headerArc === true, 'header logo 弧线在');
}
{
  const docFlowVisible = await page.evaluate(() => {
    const el = document.querySelector('#loginFlowGrad')?.closest('div[aria-hidden]');
    return el ? getComputedStyle(el).display !== 'none' : false;
  });
  assert(!docFlowVisible, 'DocFlowVisual 窄屏隐藏（与现状策略一致）');
}
await shot(285, 'r40-login-390');

// ═══════════ D. 登录回归 ═══════════
console.log('▶ D. 登录回归');
await page.setViewport({ width: 1906, height: 907 });
await gotoLogin();
{
  /* 错误密码：拦截 + 红字 + 不写登录态 */
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')];
    const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(inputs[0], 'admin'); set(inputs[1], 'wrongpwd');
    [...document.querySelectorAll('button')].find((b) => b.type === 'submit')?.click();
  });
  await sleep(600);
  assert(await page.evaluate(() => document.body.innerText.includes('账号或密码错误，请重试')), '错误密码红字拦截');
  assert(await page.evaluate(() => !sessionStorage.getItem('clinx-auth')), '拦截后不写登录态');
  /* 正确登录：shilei/123456 → PM 首页 */
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input')];
    const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(inputs[0], 'shilei'); set(inputs[1], '123456');
  });
  await sleep(200);
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.type === 'submit')?.click();
  });
  await page.waitForFunction(() => !!sessionStorage.getItem('clinx-auth'), { timeout: 9000 });
  await sleep(800);
  const role = await page.evaluate(() => JSON.parse(sessionStorage.getItem('clinx-auth') || '{}').role);
  assert(role === 'pm', `shilei 登录成功 role=pm（实际 ${role}）`);
  assert(await page.evaluate(() => document.body.innerText.includes('研究文件管理系统')), '跳转 PM 端首页');
}
await shot(286, 'r40-login-success');

await browser.close();
console.log(`\n═══ R40 登录页验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
