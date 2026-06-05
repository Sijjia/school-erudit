// Съёмка скринов для презентации форума директоров (Bilim OS).
// Бьёт в ЖИВОЙ прод с агентом — https://bilimos.kg. Логинится по ролям,
// снимает каждый реальный экран. Пилотные фичи (OCR, антибуллинг, Кундолюк,
// AKU) в коде НЕ реализованы — их тут нет, для них нужны мокапы.
//
// Запуск:  node scripts/shot-deck.mjs
// Вывод:   ./deck-shots/<NN>-<slug>.png  (+ index.txt со списком)
import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE = process.env.BASE || 'https://bilimos.kg';
const PASS = 'erudit2025';
const OUT = path.join(process.cwd(), 'deck-shots');
// 1440×900 логических × deviceScaleFactor 2 = 2880×1800 физических пикселей (ретина).
const DESK = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const DSF = 2; // deviceScaleFactor — 2× качество
const UA_PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15';

// CSS, прячущий dev-оверлеи Next.js / тосты — чтобы не лезли в кадр.
const HIDE_DEV = `
  nextjs-portal, #__next-build-watcher, [data-nextjs-toast],
  [data-nextjs-dialog-overlay], [data-nextjs-dev-tools-button],
  [data-nextjs-dev-indicator], .__next-dev-overlay { display: none !important; }
`;

// Ждём, пока страница реально догрузится: load → networkidle → исчезли
// спиннеры/скелетоны → шрифты готовы → 2.8с на доигрывание анимаций.
async function waitSettled(page) {
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
  await page.waitForTimeout(2800);
}

// slide = на каком слайде; role = под какой ролью; see = что увидит зритель
const SHOTS = [
  // login один раз без авторизации
  { n: 1, slug: 'login', login: null, route: '/login', vp: DESK, slide: 4, role: 'все', see: 'Единый вход в систему' },

  // ── Директор (super_admin) ──
  { n: 2, slug: 'dashboard-director', login: 'admin', route: '/dashboard', vp: DESK, slide: 5, role: 'директор', see: 'Вся школа на одном экране + сайдбар модулей' },
  { n: 3, slug: 'analytics', login: 'admin', route: '/analytics', vp: DESK, slide: 17, role: 'аналитик/директор', see: 'Графики успеваемости и посещаемости' },
  { n: 4, slug: 'schedule', login: 'admin', route: '/schedule', vp: DESK, slide: 14, role: 'директор', see: 'Расписание школы' },
  { n: 5, slug: 'students-list', login: 'admin', route: '/students', vp: DESK, slide: 18, role: 'куратор', see: 'Реестр учеников' },
  { n: 6, slug: 'student-profile', login: 'admin', route: '__STUDENT__', vp: DESK, slide: 18, role: 'куратор', see: 'Полный трек по ученику' },

  // ── Учитель (matematik) — АГЕНТ-хедлайнер ──
  { n: 7, slug: 'agent-panel', login: 'matematik', route: '/agent', vp: DESK, slide: 8, role: 'учитель', see: 'Лента агента: алерт/задача/совет/черновик' },
  { n: 8, slug: 'agent-draft-closeup', login: 'matematik', route: '/agent', vp: DESK, slide: 10, role: 'учитель', see: 'Черновик письма родителю + «Согласовать и отправить»', clipTopCard: true },
  { n: 9, slug: 'journal', login: 'matematik', route: '/grading', vp: DESK, slide: 14, role: 'учитель', see: 'Электронный журнал / классы с успеваемостью' },
  { n: 10, slug: 'presentations', login: 'matematik', route: '/presentations', vp: DESK, slide: 15, role: 'учитель', see: 'ИИ-генерация презентаций урока' },
  { n: 11, slug: 'tests', login: 'matematik', route: '/tests', vp: DESK, slide: 15, role: 'учитель/ученик', see: 'Конструктор тестов с автопроверкой' },

  // ── Завуч (kozlova) ──
  { n: 12, slug: 'moderation', login: 'kozlova', route: '/grading/moderation', vp: DESK, slide: 13, role: 'завуч', see: 'Очередь оценок на утверждение' },
  { n: 13, slug: 'incidents', login: 'kozlova', route: '/incidents', vp: DESK, slide: 16, role: 'куратор/завуч', see: 'Учёт происшествий (основа антибуллинг-радара)' },
  { n: 14, slug: 'urgent-issues', login: 'kozlova', route: '/urgent-issues', vp: DESK, slide: 16, role: 'завуч', see: 'Срочные вопросы школы' },

  // ── Психолог (specialist) ──
  { n: 15, slug: 'psychologist', login: 'specialist1', route: '/workspace/psychologist', vp: DESK, slide: 16, role: 'психолог', see: 'Защищённый контур психолога' },

  // ── Родитель / ученик (мобильные) ──
  { n: 16, slug: 'diary-parent-mobile', login: 'parent1', route: '/diary', vp: PHONE, slide: 18, role: 'родитель', see: 'Дневник ребёнка в телефоне' },
  { n: 17, slug: 'homework-student-mobile', login: 'student1', route: '/homework', vp: PHONE, slide: 18, role: 'ученик', see: 'Домашние задания ученика в телефоне' },
  { n: 18, slug: 'schedule-student-mobile', login: 'student1', route: '/schedule', vp: PHONE, slide: 14, role: 'ученик', see: 'Расписание в телефоне' },
];

async function login(page, who) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  // первый текстовый инпут = логин, затем пароль
  const loginInput = page.locator('input[name="login"], input[type="text"], input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])').first();
  await loginInput.fill(who);
  await page.locator('input[type="password"]').fill(PASS);
  await page.click('button[type="submit"]');
  // ждём ухода с /login
  await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

// Опции скриншота: ретина (scale device), заморозка анимаций, fullPage off.
const SHOT_BASE = { type: 'png', scale: 'device', animations: 'disabled' };

async function run() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const index = [];
  let studentId = null;

  // группируем по (login, viewport), чтобы не перелогиниваться лишний раз
  const groups = new Map();
  for (const s of SHOTS) {
    const key = `${s.login}|${s.vp.width}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  for (const [key, shots] of groups) {
    const [who, w] = key.split('|');
    const vp = w === '390' ? PHONE : DESK;
    const ctx = await browser.newContext(
      vp === PHONE
        ? { viewport: PHONE, userAgent: UA_PHONE, deviceScaleFactor: DSF, isMobile: true, hasTouch: true }
        : { viewport: DESK, deviceScaleFactor: DSF },
    );
    const page = await ctx.newPage();
    if (who !== 'null') {
      await login(page, who);
      // достанем id первого ученика для профиля (один раз)
      if (!studentId) {
        try {
          const j = await page.evaluate(async () => (await fetch('/api/v1/students')).json());
          studentId = j?.data?.[0]?.id || j?.data?.items?.[0]?.id || null;
        } catch { /* noop */ }
      }
    }

    for (const s of shots) {
      let route = s.route;
      if (route === '__STUDENT__') {
        if (!studentId) { console.log(`  ⚠ ${s.n} ${s.slug}: нет studentId — пропуск`); continue; }
        route = `/students/${studentId}`;
      }
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
      } catch { /* networkidle может таймаутить на тяжёлых стр. — продолжаем */ }
      await waitSettled(page);
      const file = `${String(s.n).padStart(2, '0')}-${s.slug}.png`;
      const opts = { ...SHOT_BASE, path: path.join(OUT, file) };
      if (s.clipTopCard) {
        // крупный план верхней карточки агента (черновик письма)
        const card = page.locator('.mantine-Card-root').first();
        if (await card.count()) {
          await card.screenshot(opts).catch(() => page.screenshot(opts));
        } else { await page.screenshot(opts); }
      } else {
        await page.screenshot(opts);
      }
      console.log(`  ✓ ${file}  [слайд ${s.slide}, ${s.role}]`);
      index.push(`${file}\t слайд ${s.slide}\t ${s.role}\t ${s.see}`);
    }
    await ctx.close();
  }

  fs.writeFileSync(path.join(OUT, 'index.txt'), index.join('\n'), 'utf8');
  await browser.close();
  console.log(`\n✅ Готово. ${index.length} скринов в:\n${OUT}\nСписок-расшифровка: deck-shots/index.txt`);
}

run().catch((e) => { console.error('FAILED:', e); process.exit(1); });
