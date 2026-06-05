// Съёмка НОВЫХ скринов для редизайна презентации (функции ночи 04→05.06).
// Бьёт в прод https://bilimos.kg (как shot-deck.mjs). Логин-скрин с карточками
// ролей снимается ОТДЕЛЬНО с локалки: BASE=http://localhost:3000 node scripts/shot-deck-v2.mjs --only login-cards
//
// Запуск:  node scripts/shot-deck-v2.mjs
// Вывод:   ./deck-shots/<NN>-<slug>.png (продолжает нумерацию с 19)
import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE = process.env.BASE || 'https://bilimos.kg';
const PASS = 'erudit2025';
const OUT = path.join(process.cwd(), 'deck-shots');
const DESK = { width: 1440, height: 900 };
const DSF = 2;

const HIDE_DEV = `
  nextjs-portal, #__next-build-watcher, [data-nextjs-toast],
  [data-nextjs-dialog-overlay], [data-nextjs-dev-tools-button],
  [data-nextjs-dev-indicator], .__next-dev-overlay { display: none !important; }
`;

async function waitSettled(page, extra = 2800) {
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.addStyleTag({ content: HIDE_DEV }).catch(() => {});
  await page.waitForFunction(() => {
    const sel = [
      '.mantine-Loader-root', '.mantine-Skeleton-root',
      '[class*="skeleton" i]', '[class*="Skeleton"]',
      '[aria-busy="true"]', '[role="progressbar"]',
    ].join(',');
    return document.querySelectorAll(sel).length === 0;
  }, { timeout: 9000 }).catch(() => {});
  await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});
  await page.waitForTimeout(extra);
}

async function login(page, who) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  const loginInput = page.locator('input[name="login"], input[type="text"], input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])').first();
  await loginInput.fill(who);
  await page.locator('input[type="password"]').fill(PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

const SHOT_BASE = { type: 'png', scale: 'device', animations: 'disabled' };

// Каждый шот — { n, slug, login, run(page, opts) } — run сам доводит страницу до нужного вида.
const SHOTS = [
  {
    n: 19, slug: 'core-graph', login: 'admin', see: 'Нейро-граф ядра школы',
    async run(page, shot) {
      await page.goto(`${BASE}/core`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await waitSettled(page, 6500); // графу нужно время на физику/пульс
      await page.screenshot(shot);
    },
  },
  {
    n: 20, slug: 'core-student-360', login: 'admin', see: '360°-карточка ученика на графе',
    async run(page, shot) {
      await page.goto(`${BASE}/core`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await waitSettled(page, 5000);
      // берём реальное имя ученика из API, чтобы поиск точно нашёл
      const name = await page.evaluate(async () => {
        const j = await (await fetch('/api/v1/students')).json();
        const s = j?.data?.[0] || j?.data?.items?.[0];
        const full = s?.fullName || s?.name || `${s?.lastName ?? ''} ${s?.firstName ?? ''}`.trim();
        return (full || '').split(' ')[0];
      }).catch(() => null);
      const search = page.getByPlaceholder('Найти ученика, класс, модуль…');
      await search.click();
      await search.fill(name || 'А');
      await page.waitForTimeout(1500);
      const opt = page.locator('[role="option"]').first();
      if (await opt.count()) { await opt.click(); } else { await search.press('Enter'); }
      await page.waitForTimeout(4000); // центрирование + карточка
      await page.screenshot(shot);
    },
  },
  {
    n: 21, slug: 'assistant-chat', login: 'admin', see: 'AI-ассистент отвечает по данным школы',
    async run(page, shot) {
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await waitSettled(page, 2000);
      await page.locator('[aria-label="Открыть ассистента"]').click({ force: true, timeout: 15000 });
      await page.waitForTimeout(1500);
      // чистый диалог, чтобы в кадр не попала прошлая переписка
      await page.locator('[aria-label="Новый диалог"]').click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
      const input = page.getByPlaceholder('Спросите про школу…');
      await input.waitFor({ state: 'visible', timeout: 10000 });
      await input.fill('Сводка по финансам');
      await input.press('Enter');
      // ждём ответа ассистента (demo-режим быстрый, но с тулами)
      await page.waitForTimeout(9000);
      await page.screenshot(shot);
    },
  },
  {
    n: 22, slug: 'dashboard-ecosystem', login: 'admin', see: 'Экосистема школы — 8 доменов ядра',
    async run(page, shot) {
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await waitSettled(page);
      const sec = page.getByText('Экосистема школы', { exact: false }).first();
      await sec.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(1200);
      await page.screenshot(shot);
    },
  },
  {
    n: 23, slug: 'dashboard-insights', login: 'admin', see: 'AI-инсайты ядра — аномалии по данным',
    async run(page, shot) {
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await waitSettled(page);
      const sec = page.getByText('AI-инсайты ядра', { exact: false }).first();
      await sec.scrollIntoViewIfNeeded().catch(() => {});
      await page.mouse.wheel(0, 450); // панель инсайтов — в центр кадра
      await page.waitForTimeout(1400);
      await page.screenshot(shot);
    },
  },
  {
    n: 24, slug: 'admission-crm', login: 'admin', see: 'CRM приёмной — канбан 7 этапов',
    async run(page, shot) {
      await page.goto(`${BASE}/admission`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await waitSettled(page);
      await page.screenshot(shot);
    },
  },
  {
    n: 25, slug: 'journal-edupage', login: 'matematik', see: 'Журнал EduPage-style — колонки назначений',
    async run(page, shot) {
      await page.goto(`${BASE}/journal`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await waitSettled(page, 2000);
      // выбираем первый класс-предмет в Select'е
      const sel = page.locator('input[role="combobox"], .mantine-Select-input').first();
      await sel.click({ timeout: 10000 });
      await page.waitForTimeout(900);
      await page.locator('[role="option"]').first().click({ timeout: 8000 });
      await waitSettled(page, 4000); // журнал грузит назначения и оценки
      await page.screenshot(shot);
    },
  },
  {
    n: 26, slug: 'journal-attendance', login: 'matematik', see: 'Экран посещаемости — карточки-аватары',
    async run(page, shot) {
      await page.goto(`${BASE}/journal/attendance`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await waitSettled(page, 2000);
      // выбираем класс (Select или нативный select)
      const native = page.locator('select').first();
      if (await native.count()) {
        await native.selectOption({ index: 1 }).catch(() => native.selectOption({ index: 0 }));
      } else {
        const sel = page.locator('input[role="combobox"], .mantine-Select-input').first();
        await sel.click({ timeout: 10000 });
        await page.waitForTimeout(900);
        await page.locator('[role="option"]').first().click({ timeout: 8000 });
      }
      await waitSettled(page, 3500);
      await page.screenshot(shot);
    },
  },
  {
    n: 27, slug: 'finance-penalty', login: 'accountant1', see: 'Бухгалтерия — счета и пени за просрочку',
    async run(page, shot) {
      await page.goto(`${BASE}/workspace/accounting`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await waitSettled(page, 3000);
      await page.screenshot(shot);
    },
  },
  {
    n: 28, slug: 'knowledge-base', login: 'admin', see: 'База знаний школы',
    async run(page, shot) {
      await page.goto(`${BASE}/knowledge`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await waitSettled(page);
      await page.screenshot(shot);
    },
  },
  {
    // с ЛОКАЛКИ: BASE=http://localhost:3000 node scripts/shot-deck-v2.mjs --only login-cards
    n: 29, slug: 'login-cards', login: null, see: 'Новый выбор ролей — карточки с эмодзи',
    async run(page, shot) {
      // первый заход прогревает webpack-компиляцию на локалке, второй — снимаем
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
      await page.waitForTimeout(4000);
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
      await page.waitForSelector('input[type="password"]', { timeout: 30000 }).catch(() => {});
      await waitSettled(page, 3000);
      await page.screenshot(shot);
    },
  },
];

async function run() {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
  const shots = only ? SHOTS.filter((s) => s.slug === only) : SHOTS.filter((s) => s.slug !== 'login-cards');
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // группируем по логину
  const groups = new Map();
  for (const s of shots) {
    if (!groups.has(s.login)) groups.set(s.login, []);
    groups.get(s.login).push(s);
  }

  for (const [who, list] of groups) {
    const ctx = await browser.newContext({ viewport: DESK, deviceScaleFactor: DSF });
    const page = await ctx.newPage();
    if (who) await login(page, who);
    for (const s of list) {
      const file = `${String(s.n).padStart(2, '0')}-${s.slug}.png`;
      try {
        await s.run(page, { ...SHOT_BASE, path: path.join(OUT, file) });
        console.log(`  ✓ ${file}  — ${s.see}`);
      } catch (e) {
        console.log(`  ✗ ${file}: ${e.message?.split('\n')[0]}`);
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log('\n✅ Готово:', OUT);
}
run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
