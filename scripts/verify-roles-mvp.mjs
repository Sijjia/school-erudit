// Полная ревизия MVP по ролям: вход каждой ролью → домашняя → ключевые страницы
// → проверка на «Доступ ограничен»/ошибки → скрины. Запуск:
//   node scripts/verify-roles-mvp.mjs [baseUrl]
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.argv[2] || 'https://bilimos.kg';
const PASS = 'erudit2025';
const OUT = 'verify-shots/roles';
mkdirSync(OUT, { recursive: true });

/** роль → [логин, ожидаемая домашняя (фрагмент url), ключевые страницы] */
const ROLES = [
  ['admin', '/dashboard', ['/core', '/admission', '/journal', '/students', '/knowledge']],
  ['analyst1', '/dashboard', ['/analytics', '/core']],
  ['kozlova', '/dashboard', ['/grading/moderation', '/journal', '/workspace/accounting']],
  ['secretary1', '/dashboard', ['/admission', '/core', '/classes']],
  ['matematik', '/today', ['/journal']],
  ['curator1', '/today', ['/journal']],
  ['specialist1', '/dashboard', ['/workspace/psychologist', '/workspace/speech', '/workspace/medical']],
  ['student1', '/diary', ['/homework', '/tests']],
  ['parent1', '/diary', ['/meals', '/applications']],
  ['accountant1', '/workspace/accounting', []],
  ['psychologist1', '/workspace/psychologist', ['/students', '/incidents']],
  ['doctor1', '/workspace/medical', ['/students']],
  ['hr1', '/staff', ['/teachers', '/documents']],
  ['librarian1', '/library', []],
  ['cook1', '/workspace/kitchen', ['/meals']],
  ['zavhoz1', '/workspace/maintenance', []],
];

const BAD_MARKERS = ['Доступ ограничен', 'Application error', 'Internal Server Error', 'This page could not be found'];

const report = [];

const browser = await chromium.launch();
for (const [login, expectedHome, pages] of ROLES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('JS: ' + e.message.slice(0, 100)));
  page.on('response', (r) => {
    if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`);
  });

  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.locator('input:not([type=password])').first().fill(login);
    await page.locator('input[type=password]').fill(PASS);
    await page.click('button[type=submit]');
    await page.waitForTimeout(7000);

    const url = new URL(page.url()).pathname;
    const homeOk = url.startsWith(expectedHome);
    const body = await page.locator('body').innerText().catch(() => '');
    const badHome = BAD_MARKERS.filter((m) => body.includes(m));
    await page.screenshot({ path: `${OUT}/${login}-home.png` });

    const pageResults = [];
    for (const p of pages) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(2200);
      const text = await page.locator('body').innerText().catch(() => '');
      const bad = BAD_MARKERS.filter((m) => text.includes(m));
      pageResults.push({ p, ok: bad.length === 0, bad });
      if (bad.length) await page.screenshot({ path: `${OUT}/${login}${p.replace(/\//g, '_')}-FAIL.png` });
    }

    const fails = pageResults.filter((r) => !r.ok);
    const status = homeOk && badHome.length === 0 && fails.length === 0 && errors.length === 0 ? 'PASS' : 'FAIL';
    report.push({ login, status, home: `${url}${homeOk ? '' : ` (ждали ${expectedHome})`}`, badHome, fails, errors: errors.slice(0, 3) });
    console.log(`${status === 'PASS' ? '✅' : '❌'} ${login}: home=${url}${badHome.length ? ' BAD:' + badHome : ''}${fails.length ? ' failPages:' + fails.map((f) => f.p).join(',') : ''}${errors.length ? ' errs:' + errors.join('; ') : ''}`);
  } catch (e) {
    report.push({ login, status: 'ERROR', error: e.message.slice(0, 120) });
    console.log(`💥 ${login}: ${e.message.slice(0, 120)}`);
  }
  await ctx.close();
}
await browser.close();

const failed = report.filter((r) => r.status !== 'PASS');
console.log(`\n===== ИТОГ: ${report.length - failed.length}/${report.length} PASS =====`);
if (failed.length) console.log(JSON.stringify(failed, null, 1));
