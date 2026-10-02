// R43 外观背景设置面板优化验证
//   A 设置面板：两个自定义区无十六进制字符、圆形色块存在且背景与当前值一致、input[type=color] 在
//   B 预设应用：深空蓝/石墨蓝灰/檀色 切换后侧栏 computed background 更新、白字对比度 ≥4.5
//   C 恢复默认青蓝收尾；色块 label 内含 input[type=color]（点击可触发取色输入）
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:5199';
const SHOTS = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/shots/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const assert = (cond, name) => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ FAIL: ${name}`); }
};

/* sRGB 相对亮度 + 对比度（白字 85% 不透明度叠在底色上的有效色） */
const lum = (r, g, b) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrastWhite85 = (r, g, b) => {
  const e = [255 * 0.85 + r * 0.15, 255 * 0.85 + g * 0.15, 255 * 0.85 + b * 0.15];
  const l1 = lum(...e), l2 = lum(r, g, b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
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

/* 登录 PM（清登录态 + localStorage 外观偏好，保证从默认青蓝出发） */
await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
await page.evaluate(() => {
  sessionStorage.clear();
  localStorage.removeItem('clinx-bg-v1');
  localStorage.removeItem('clinx-nav-bg-v1');
});
await page.reload({ waitUntil: 'networkidle0' });
await page.goto(BASE + '/#/login', { waitUntil: 'networkidle0' });
await sleep(700);
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')];
  const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  set(inputs[0], 'shilei'); set(inputs[1], '123456');
  [...document.querySelectorAll('button')].find((b) => b.type === 'submit')?.click();
});
await page.waitForFunction(() => !!sessionStorage.getItem('clinx-auth'), { timeout: 9000 });
await sleep(800);
console.log('▶ 登录 PM 成功');

/* 打开设置菜单 → 外观背景（radix 触发器需真实指针事件，用 page.click） */
const gearFound = await page.evaluate(() => {
  const gear = [...document.querySelectorAll('header svg')].find((s) => s.classList.contains('lucide-settings'));
  const trg = gear?.closest('button');
  trg?.setAttribute('data-r43-gear', '1');
  return !!trg;
});
assert(gearFound, '设置齿轮按钮定位到');
await page.click('[data-r43-gear="1"]');
await sleep(600);
const itemFound = await page.evaluate(() => {
  const item = [...document.querySelectorAll('[role="menuitem"], [data-slot="dropdown-menu-item"]')]
    .find((el) => el.textContent.includes('外观背景'));
  item?.setAttribute('data-r43-bg', '1');
  return !!item;
});
assert(itemFound, '「外观背景」菜单项定位到');
await page.click('[data-r43-bg="1"]');
await sleep(700);
await page.waitForFunction(() => !!document.querySelector('[role="dialog"]'), { timeout: 5000 });
console.log('▶ 外观背景面板已打开');

// ═══════════ A. 自定义色块 ═══════════
console.log('▶ A. 自定义色值字符 → 圆形色块');
const panelProbe = () => page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const swatches = [...dlg.querySelectorAll('label.rounded-full')].map((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    hasColorInput: !!el.querySelector('input[type="color"]'),
    size: `${el.offsetWidth}x${el.offsetHeight}`,
  }));
  return {
    text: dlg.innerText,
    hexLeak: /#[0-9a-fA-F]{3,6}\b/.test(dlg.innerText),
    swatches,
    colorInputs: dlg.querySelectorAll('input[type="color"]').length,
    presetNames: [...dlg.querySelectorAll('.grid button span:last-child')].map((s) => s.textContent),
  };
});
{
  const p = await panelProbe();
  assert(!p.hexLeak, '面板无十六进制色值字符');
  assert(p.swatches.length === 2, `圆形色块 ×2（实际 ${p.swatches.length}）`);
  assert(p.swatches.every((s) => s.hasColorInput), '色块内含 input[type=color]（点击可触发取色）');
  assert(p.swatches.every((s) => s.size === '22x22'), `色块 22px 圆形（实际 ${p.swatches.map((s) => s.size).join('/')}）`);
  assert(p.swatches[0]?.bg === 'rgb(243, 245, 249)', `页面背景色块=当前值 #F3F5F9（实际 ${p.swatches[0]?.bg}）`);
  assert(p.swatches[1]?.bg === 'rgb(20, 184, 166)', `导航色块=当前渐变基色 #14B8A6（实际 ${p.swatches[1]?.bg}）`);
  assert(p.colorInputs === 4, `input[type=color] ×4（自定义条+色块各 2 组，实际 ${p.colorInputs}）`);
  const nav = p.presetNames.filter((n) => ['默认青蓝', '深空蓝', '石墨蓝灰', '墨玉绿', '藏青', '暮山紫', '曜石黑', '檀色'].includes(n));
  assert(nav.length === 8, `导航 8 新预设就位（${nav.join('、')}）`);
  assert(!p.presetNames.some((n) => ['落日橙', '玫瑰红', '翡翠绿', '深海蓝', '暮光紫', '纯粹青'].includes(n)), '旧高饱和预设已移除');
}
await shot(293, 'r43-settings-panel');

// ═══════════ B. 应用新预设 ═══════════
console.log('▶ B. 应用新预设（侧栏背景切换 + 白字对比度）');
const applyPreset = async (name) => {
  await page.evaluate((n) => {
    const dlg = document.querySelector('[role="dialog"]');
    [...dlg.querySelectorAll('.grid button')].find((b) => b.textContent.trim() === n)?.click();
  }, name);
  await sleep(500);
};
const asideProbe = () => page.evaluate(() => {
  const aside = document.querySelector('aside');
  const bgImg = getComputedStyle(aside).backgroundImage;
  const m = bgImg.match(/rgb\((\d+), (\d+), (\d+)\)/);
  const item = aside.querySelector('nav button:not(.bg-white) span') || aside.querySelector('nav button span');
  return { bgImg, top: m ? [+m[1], +m[2], +m[3]] : null, textColor: getComputedStyle(item).color };
});
const expectPreset = async (name, rgb, num, shotName) => {
  await applyPreset(name);
  const a = await asideProbe();
  assert(a.top && a.top.join(',') === rgb.join(','), `${name} 侧栏背景已切换（顶色 rgb(${a.top?.join(',')})）`);
  const ratio = a.top ? contrastWhite85(...a.top) : 0;
  assert(a.top && ratio >= 4.5, `${name} 白字对比度 ${ratio.toFixed(2)}:1 ≥ 4.5（文字色 ${a.textColor}）`);
  await shot(num, shotName);
};
await applyPreset('默认青蓝'); // 确保基线
await expectPreset('深空蓝', [30, 64, 175], 294, 'r43-nav-deepspace');
await expectPreset('石墨蓝灰', [71, 85, 105], 295, 'r43-nav-slate');
await expectPreset('檀色', [131, 80, 70], 296, 'r43-nav-tan');

// ═══════════ C. 恢复默认 ═══════════
console.log('▶ C. 恢复默认青蓝');
{
  // 重新打开面板确认色块联动更新为檀色基色（应用预设后 navBaseColor 应变色）
  const p = await panelProbe();
  assert(p.swatches[1]?.bg === 'rgb(131, 80, 70)', `檀色应用后导航色块联动（实际 ${p.swatches[1]?.bg}）`);
  assert(!p.hexLeak, '应用预设后面板仍无十六进制字符');
}
await applyPreset('默认青蓝');
{
  const a = await asideProbe();
  assert(a.top && a.top.join(',') === '20,184,166', `恢复默认青蓝（顶色 rgb(${a.top?.join(',')})）`);
}
await shot(297, 'r43-nav-restored');

await browser.close();
console.log(`\n═══ R43 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
