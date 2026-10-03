// C2 隐藏旧命名入口（可回退）验证
//   用法：node scripts/shot100.mjs hidden   → LEGACY_NAMING_ENTRY=false 态断言（三入口不可见 + C1 回归 + CRA 不受影哝）
//         node scripts/shot100.mjs visible  → LEGACY_NAMING_ENTRY=true 回退态断言（三入口重现）
import puppeteer from 'puppeteer-core';

const MODE = process.argv[2] ?? 'hidden';
const BASE = 'http://localhost:5199';
const SHOTS = 'C:/Users/huawe/Documents/Kimi/Workspaces/ClinicalTrialsDocumentM/shots/';
const FIXTURE = 'C:\\Users\\huawe\\Documents\\Kimi\\Workspaces\\ClinicalTrialsDocumentM\\C2-知情同意书.txt';
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
let pageErrors = 0;
page.on('pageerror', (e) => { pageErrors++; console.log('  [pageerror]', e.message); });
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
const clickBtn = (text, scope = 'document') =>
  page.evaluate(({ text, scope }) => {
    const root = scope === 'dialog' ? document.querySelector('[role="dialog"]') : document;
    const b = [...(root ?? document).querySelectorAll('button')].find((x) => x.textContent.trim().includes(text));
    b?.click();
    return !!b;
  }, { text, scope });
const selPick = (selEl, match) => {
  const opt = [...selEl.options].find((o) => o.value && o.textContent.includes(match)) ?? [...selEl.options].find((o) => o.value);
  if (!opt) return false;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(selEl, opt.value);
  selEl.dispatchEvent(new Event('change', { bubbles: true }));
  return opt.textContent;
};

/* TRANSFER 入口探针 */
const transferProbe = () => page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim());
  const links = [...document.querySelectorAll('a, button, span')].map((x) => x.textContent.trim());
  return {
    namingBtn: btns.some((t) => t.includes('命名规则')),
    smartRename: links.some((t) => t === '智能命名'),
    smartCorrect: links.some((t) => t === '智能纠错'),
    routeBtn: btns.some((t) => t.includes('归档规则')),
    unsortedBtn: btns.some((t) => t.includes('待分拣')),
  };
});

if (MODE === 'hidden') {
  /* 空白环境 */
  await page.goto(BASE + '/', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => { localStorage.removeItem('clinx-data-v2'); });

  // ═══════════ A. PM TRANSFER 三入口隐藏 ═══════════
  console.log('▶ A. PM TRANSFER 旧命名入口隐藏（flag=false）');
  await login('shilei', '123456');
  await nav('transfer');
  {
    const p = await transferProbe();
    assert(!p.namingBtn, '「命名规则」按钮不可见');
    assert(!p.smartRename && !p.smartCorrect, '行内「智能命名/智能纠错」不可见');
    assert(p.routeBtn && p.unsortedBtn, '邻近功能（归档规则/待分拣）保留');
  }
  await shot(305, 'c2-transfer-hidden');

  // ═══════════ B. C1 归档/上传确认制回归 ═══════════
  console.log('▶ B. C1 确认制回归（建目录→绑骨架→钻取上传→命名向导）');
  await nav('study');
  await clickBtn('创建目录');
  await page.waitForFunction(() => !!document.querySelector('[role="dialog"]'), { timeout: 5000 });
  await sleep(500);
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const pill = [...dlg.querySelectorAll('div.rounded-full')].find((d) => d.textContent.includes('标准模板'));
    [...pill.querySelectorAll('button')].find((b) => b.textContent.includes('标准模板'))?.click();
  });
  await sleep(400);
  await page.evaluate((selPickSrc) => {
    const sel = document.querySelector('[role="dialog"] tbody select');
    eval(selPickSrc)(sel, 'RJQM');
  }, selPick.toString());
  await sleep(400);
  await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const inp = [...dlg.querySelectorAll('tbody input')].find((i) => i.placeholder?.includes('项目编号'));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, 'C2-TPL-001');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(300);
  await clickBtn('确认创建', 'dialog');
  await sleep(1000);
  assert(await page.evaluate(() => document.body.innerText.includes('目录创建完成')), '模板建目录成功（toast 目录创建完成）');

  /* 钻取目录（注意避开页面上方统计表同编号行：匹配含「STUDY TMF」目录名的行） */
  await page.evaluate(() => {
    [...document.querySelectorAll('tbody tr')].find((tr) => tr.textContent.includes('C2-TPL-001 STUDY TMF'))?.click();
  });
  await sleep(900);
  await page.evaluate(() => {
    const tr = [...document.querySelectorAll('tbody tr')].find((x) => x.textContent.includes('受试者信息'));
    [...(tr?.querySelectorAll('button, a, span') ?? [])].find((e) => e.textContent.trim() === '绑定骨架')?.click();
  });
  await page.waitForFunction(() => !!document.querySelector('[role="dialog"]'), { timeout: 5000 });
  await sleep(500);
  {
    const picked = await page.evaluate((selPickSrc) => {
      const sel = document.querySelector('[role="dialog"] select');
      return sel ? eval(selPickSrc)(sel, '方案类文件命名') : false;
    }, selPick.toString());
    assert(!!picked, `绑定骨架下拉选中（${picked}）`);
  }
  await clickBtn('保存', 'dialog');
  await sleep(800);
  assert(await page.evaluate(() => document.body.innerText.includes('已绑定骨架')), '骨架绑定成功（toast 已绑定骨架）');

  /* 进入 受试者信息 → 上传 → 命名向导（继承骨架） */
  await page.evaluate(() => {
    [...document.querySelectorAll('tbody button')].find((b) => b.textContent.trim() === '受试者信息')?.click();
  });
  await sleep(800);
  await clickBtn('上传');
  await page.waitForFunction(() => !!document.querySelector('[role="dialog"]'), { timeout: 5000 });
  await sleep(600);
  {
    const fi = await page.$('[role="dialog"] input[type="file"]:not([webkitdirectory])');
    assert(!!fi, '钻取上传弹窗文件输入就位');
    if (fi) await fi.uploadFile(FIXTURE);
    await sleep(900);
    /* 文件名含「知情同意书」→ analyzeName 自动命中目标文档 + AI 预填文档类型，无需手选 */
    const dlgText = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '');
    assert(dlgText.includes('C2-知情同意书'), '文件行已暂存（目标文档自动命中）');
    assert(dlgText.includes('骨架·'), '命名向导展开（骨架徽标在，继承绑定）');
    await shot(306, 'c2-upload-wizard');
    /* AI 预填文档类型为异步分析，轮询等待确认按钮就绪（最长 8s）；匹配对齐 clickBtn 用 includes */
    const confirmReady = await page.waitForFunction(
      () => {
        const dlg = document.querySelector('[role="dialog"]');
        const b = [...(dlg ?? document).querySelectorAll('button')].find((x) => x.textContent.trim().includes('确认上传'));
        return !!b && !b.disabled;
      },
      { timeout: 8000 },
    ).then(() => true).catch(() => false);
    if (!confirmReady) {
      const dbg = await page.evaluate(() =>
        [...(document.querySelector('[role="dialog"]') ?? document).querySelectorAll('button')]
          .map((x) => `${JSON.stringify(x.textContent.trim())}|disabled=${x.disabled}`).join(' ; '));
      console.log('  [dbg] dialog buttons:', dbg);
    }
    assert(confirmReady, '确认上传可用（文档类型 AI 预填就绪）');
    await clickBtn('确认上传', 'dialog');
    await sleep(1200);
    const ok = await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('clinx-data-v2') || '{}');
      return (d.files || []).some((f) => f.namingTemplateId === 'nt1' && f.status === 'archived');
    });
    assert(ok, '向导确认上传落库（骨架命名 + 直接归档）');
  }

  /* B4. TRANSFER 根目录上传一个文件（制造未归档行）→ 行内无智能命名 */
  console.log('▶ B4. TRANSFER 根上传 + 行内入口隐藏复查');
  await nav('transfer');
  await clickBtn('上传');
  await sleep(400);
  await clickBtn('上传文件');
  await page.waitForFunction(() => !!document.querySelector('[role="dialog"]'), { timeout: 5000 });
  await sleep(600);
  {
    /* 先选项目编号（requireProject），再喂文件 → PM 自动命名直接落库关弹窗 */
    await page.evaluate(() => {
      const sel = document.querySelector('[role="dialog"] select');
      const opt = sel && [...sel.options].find((o) => o.value);
      if (opt) {
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(400);
    const fi = await page.$('[role="dialog"] input[type="file"]:not([webkitdirectory])');
    if (fi) await fi.uploadFile(FIXTURE);
    await sleep(1500);
    const row = await page.evaluate(() => {
      const tr = [...document.querySelectorAll('tbody tr')].find((x) => x.textContent.includes('知情同意书'));
      if (!tr) return null;
      return { hasSmart: tr.textContent.includes('智能命名') || tr.textContent.includes('智能纠错'), text: tr.textContent.slice(0, 50) };
    });
    assert(!!row, `根上传文件落库并列于 TRANSFER（${row?.text ?? '未找到'}…）`);
    if (row) assert(!row.hasSmart, '该行无智能命名/智能纠错入口');
  }

  // ═══════════ C. CRA 端不受开关影响 ═══════════
  console.log('▶ C. CRA（zhanglan）上传向导回归');
  await login('zhanglan', '123456');
  await nav('transfer');
  await clickBtn('上传');
  await sleep(600);
  {
    const open = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    assert(open, 'CRA 上传弹窗正常打开');
    /* 先选项目编号（requireProject），再喂文件 → withNamingConfirm 暂存确认流 */
    await page.evaluate(() => {
      const sel = document.querySelector('[role="dialog"] select');
      const opt = sel && [...sel.options].find((o) => o.value);
      if (opt) {
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(400);
    const fi = await page.$('[role="dialog"] input[type="file"]:not([webkitdirectory])');
    if (fi) await fi.uploadFile(FIXTURE);
    await sleep(1000);
    const t = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '');
    assert(t.includes('C2-知情同意书'), 'CRA 文件行正常暂存（逐行确认命名流程在）');
    const confirmReady = await page.evaluate(() => {
      const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.textContent.trim() === '确认上传');
      return b ? !b.disabled : false;
    });
    assert(confirmReady, 'CRA 确认上传可用');
    await shot(307, 'c2-cra-upload');
    await clickBtn('确认上传', 'dialog');
    await sleep(1200);
    const ok = await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('clinx-data-v2') || '{}');
      return (d.files || []).some((f) => f.uploader === '张兰' && f.name.includes('知情同意'));
    });
    assert(ok, 'CRA 确认上传落库（命名向导全链路不受开关影响）');
  }
  assert(pageErrors === 0, `全程无页面报错（pageerror=${pageErrors}）`);
} else {
  // ═══════════ D. 回退态（flag=true）：三入口重现 ═══════════
  console.log('▶ D. 回退态 LEGACY_NAMING_ENTRY=true');
  await login('shilei', '123456');
  await nav('transfer');
  /* 上传一个文件造行（PM 根上传：先选项目编号再喂文件，直接落库） */
  await clickBtn('上传');
  await sleep(400);
  await clickBtn('上传文件');
  await page.waitForFunction(() => !!document.querySelector('[role="dialog"]'), { timeout: 5000 });
  await sleep(600);
  await page.evaluate(() => {
    const sel = document.querySelector('[role="dialog"] select');
    const opt = sel && [...sel.options].find((o) => o.value);
    if (opt) {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await sleep(400);
  const fi = await page.$('[role="dialog"] input[type="file"]:not([webkitdirectory])');
  if (fi) await fi.uploadFile(FIXTURE);
  await sleep(1500);
  {
    const p = await transferProbe();
    assert(p.namingBtn, '「命名规则」按钮重新出现');
    assert(p.smartRename && p.smartCorrect, '行内「智能命名/智能纠错」重新出现');
  }
  /* 点命名规则 → NamingRuleDialog 打开 */
  await clickBtn('命名规则');
  await sleep(700);
  {
    const dlg = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '');
    assert(dlg.includes('命名'), `NamingRuleDialog 可打开（${dlg.slice(0, 20)}…）`);
    await shot(308, 'c2-restore-naming-rule');
    await page.keyboard.press('Escape');
    await sleep(500);
  }
  /* 点行内智能命名 → SmartProcessDialog 打开 */
  await page.evaluate(() => {
    [...document.querySelectorAll('tbody span, tbody a, tbody button')].find((e) => e.textContent.trim() === '智能命名')?.click();
  });
  await sleep(700);
  {
    const dlg = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '');
    assert(dlg.length > 10, `SmartProcessDialog 可打开（${dlg.slice(0, 24)}…）`);
    await shot(309, 'c2-restore-smart-dialog');
  }
  assert(pageErrors === 0, `回退态全程无页面报错（pageerror=${pageErrors}）`);
}

await browser.close();
console.log(`\n═══ C2(${MODE}) 验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
