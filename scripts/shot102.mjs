// C4 归档路由升级验证：docType 业务字段主路由 / analyzeName 兜底 / 冲突以 docType 为准 / 路由来源可追溯
//   用法：node scripts/shot102.mjs
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

/* ---- 数据注入（读-改-写 localStorage 后立刻 reload，防内存态回写覆盖） ---- */
const CAT = { id: 'cat-c4', kind: 'study', name: 'C4-TPL-001 STUDY TMF', projectNo: 'C4-TPL-001', creator: '石磊', createDate: '2026-10-03', updateDate: '2026-10-03', size: '0KB', status: '未完成' };
const mk = (id, name, extra = {}) => ({
  id, name, kind: 'pdf', projectNo: 'C4-TPL-001', center: '', uploader: '石磊',
  uploadDate: '2026-10-03', size: '12KB', status: 'uploaded', ...extra,
});
const FILES = [
  /* 场景 A：文件名无任何词典词，docType=伦理批件 → 应走业务字段路由到 02 伦理与监管文件/伦理委员会批件 */
  mk('c4-a', 'c4a-随机附件.pdf', { docType: '伦理批件' }),
  /* 场景 B：无 docType 旧文件，文件名含「知情」→ analyzeName 兜底到 04 受试者文件/知情同意书（旧行为不变） */
  mk('c4-b', 'ON101-知情同意书-V1.0（2026-10-03）.pdf'),
  /* 场景 C：文件名误导（含「伦理」会误路由 02），docType=简历 → 以 docType 为准落 03 研究者与中心文件/研究者简历 */
  mk('c4-c', '伦理批件-终审版.pdf', { docType: '简历' }),
  /* C3 口径探针：已归档且带 namingTemplateId（统计卡只认它，与 routeSource 无关） */
  mk('c3probe', 'C4-TPL-001-方案-V1.0-20261003.pdf', { status: 'archived', folderId: 'cat-c4', uploader: '张兰', namingTemplateId: 'nt1', docType: '方案' }),
];
const inject = async () => {
  await page.evaluate(({ CAT, FILES }) => {
    const d = JSON.parse(localStorage.getItem('clinx-data-v2') || '{}');
    d.catalogs = [CAT];
    d.files = FILES;
    d.namingLogs = [];
    localStorage.setItem('clinx-data-v2', JSON.stringify(d));
  }, { CAT, FILES });
};
/* PM TRANSFER 行内归档（uploader=石磊 才在列表可见） */
const clickArchive = (fileName) => page.evaluate((fileName) => {
  const tr = [...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes(fileName));
  const btn = tr ? [...tr.querySelectorAll('button')].find((b) => b.textContent.trim() === '归档') : null;
  btn?.click();
  return !!btn;
}, fileName);
/* 落库落点读取：状态/来源/父级类型文件夹/分区文件夹/目录 */
const readPlacement = (fileId) => page.evaluate((fileId) => {
  const d = JSON.parse(localStorage.getItem('clinx-data-v2') || '{}');
  const byId = new Map((d.files || []).map((x) => [x.id, x]));
  const f = byId.get(fileId);
  if (!f) return null;
  const parent = f.parentId ? byId.get(f.parentId) : null;
  const zone = parent?.parentId ? byId.get(parent.parentId) : null;
  return {
    status: f.status, folderId: f.folderId, routeSource: f.routeSource ?? null,
    parentName: parent?.name ?? null, zoneName: zone?.name ?? null, zoneFolderId: zone?.folderId ?? null,
  };
}, fileId);
/* 归档后立刻抓 toast 文本快照（sonner 会自动消失） */
const toastSnap = async () => {
  await page.waitForFunction(() => document.body.innerText.includes('归档成功') || document.body.innerText.includes('待分拣'), { timeout: 6000 });
  await sleep(300);
  return page.evaluate(() => document.body.innerText);
};
/* C3 统计卡读数（同 shot101 探针） */
const readCoverage = () => page.evaluate(() => {
  const find = (label) => {
    const el = [...document.querySelectorAll('div')].find((d) => d.textContent.trim() === label);
    const card = el?.closest('.rounded-xl');
    const numEl = card?.querySelector('[class*="32px"]');
    const pctEl = card?.querySelector('.mt-2 span');
    return { num: numEl?.childNodes[0]?.textContent.trim() ?? null, pct: pctEl?.textContent.trim() ?? null };
  };
  return { bound: find('骨架命名 · 绑定目录新流程'), unbound: find('未绑定 · 旧通道上传') };
});

console.log('▶ 0. 注入 C4 场景数据 + PM 登录进 TRANSFER');
await gotoLogin();
await inject();
await login('shilei', '123456');
await nav('transfer');
const listed = await page.evaluate(() => {
  const t = document.body.innerText;
  return ['c4a-随机附件', '知情同意书-V1.0', '伦理批件-终审版'].every((x) => t.includes(x));
});
assert(listed, '三个场景文件列于 TRANSFER（uploader=石磊 口径）');

console.log('▶ A. docType 主路由（文件名无词典词，docType=伦理批件 → 02/伦理委员会批件）');
assert(await clickArchive('c4a-随机附件'), 'A 行内归档按钮点击');
const toastA = await toastSnap();
let p = await readPlacement('c4-a');
assert(p?.status === 'archived' && p?.folderId === 'cat-c4', 'A 落库 archived 进 C4 目录');
assert(p?.parentName === '伦理委员会批件' && p?.zoneName === '02 伦理与监管文件' && p?.zoneFolderId === 'cat-c4',
  `A 落点 02 伦理与监管文件/伦理委员会批件（实际 ${p?.zoneName}/${p?.parentName}）`);
assert(p?.routeSource === 'docType', `A routeSource=docType（实际 ${p?.routeSource}）`);
assert(toastA.includes('路由来源：业务字段 1 个 · 文件名解析 0 个'), 'A toast 含路由来源行');
await shot(313, 'c4-route-doctype-toast');
await sleep(4200); // 等 toast 退场

console.log('▶ B. 无 docType 旧文件 → analyzeName 兜底（落点与旧逻辑一致）');
assert(await clickArchive('知情同意书-V1.0'), 'B 行内归档按钮点击');
const toastB = await toastSnap();
p = await readPlacement('c4-b');
assert(p?.parentName === '知情同意书' && p?.zoneName === '04 受试者文件',
  `B 落点 04 受试者文件/知情同意书（实际 ${p?.zoneName}/${p?.parentName}）`);
assert(p?.routeSource === 'filenameParse', `B routeSource=filenameParse（实际 ${p?.routeSource}）`);
assert(toastB.includes('归档成功') && !toastB.includes('路由来源'), 'B toast 归档成功且无来源行（纯解析批旧文案不变）');
await sleep(4200);

console.log('▶ C. docType 与文件名解析冲突（文件名误导「伦理」→02，docType=简历 → 以 docType 为准落 03/研究者简历）');
assert(await clickArchive('伦理批件-终审版'), 'C 行内归档按钮点击');
const toastC = await toastSnap();
p = await readPlacement('c4-c');
assert(p?.parentName === '研究者简历' && p?.zoneName === '03 研究者与中心文件',
  `C 落点 03 研究者与中心文件/研究者简历——docType 优先（实际 ${p?.zoneName}/${p?.parentName}）`);
assert(p?.routeSource === 'docType', `C routeSource=docType（实际 ${p?.routeSource}）`);
assert(toastC.includes('路由来源：业务字段 1 个'), 'C toast 含路由来源行');
await shot(314, 'c4-route-conflict-toast');

console.log('▶ D. STUDY TMF 钻取验证三区结构（截图 315）');
await nav('study');
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tbody tr')].find((r) => r.innerText.includes('C4-TPL-001 STUDY TMF'));
  tr?.querySelector('td button, td a, td span')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await sleep(900);
await shot(315, 'c4-study-drilldown');
const drill = await page.evaluate(() => document.body.innerText);
assert(drill.includes('02 伦理与监管文件') && drill.includes('03 研究者与中心文件') && drill.includes('04 受试者文件'),
  '钻取视图三分区文件夹均在');

console.log('▶ E. C3 统计卡口径回归（仍按 namingTemplateId，routeSource 不串口径）');
await login('admin', '123456');
await nav('audit');
const cov = await readCoverage();
assert(cov.bound?.num === '1' && cov.bound?.pct === '占上传 25%', `C3 卡绑定 1 个 25%（实际 ${cov.bound?.num}/${cov.bound?.pct}）`);
assert(cov.unbound?.num === '3' && cov.unbound?.pct === '未绑定占比 75%',
  `C3 卡未绑定 3 个 75%——C 场景文件虽有 docType+routeSource 仍计未绑定（实际 ${cov.unbound?.num}/${cov.unbound?.pct}）`);
await shot(316, 'c4-audit-coverage-regression');

console.log('▶ F. 回归：PM HOME / SUBMISSION / REVIEW 不崩');
await login('shilei', '123456');
for (const [hash, mark] of [['home', 'HOME'], ['submission', 'SUBMISSION'], ['review', 'REVIEW']]) {
  await nav(hash);
  const ok = await page.evaluate((m) => document.body.innerText.includes(m), mark);
  assert(ok, `PM ${mark} 页打开不崩`);
}

assert(pageErrors === 0, `全程无页面报错（pageerror=${pageErrors}）`);
await browser.close();
console.log(`\n═══ C4 路由升级验证: ${passed} 通过, ${failed} 失败 ═══`);
process.exit(failed ? 1 : 0);
