// Ассистент под каждой ролью: вопрос по роли → ответ не пустой и без 500.
// node scripts/verify-assistant-roles.mjs [baseUrl]
const BASE = process.argv[2] || 'https://bilimos.kg';
const PASS = 'erudit2025';

const CASES = [
  ['admin', 'Сколько учеников в школе?', 'Учеников'],
  ['analyst1', 'Сводка по финансам', 'Начислено'],
  ['kozlova', 'Сводка по финансам', 'Начислено'],
  ['secretary1', 'Что в воронке приёмной?', 'заявок'],
  ['matematik', 'Сводка по моим классам', 'учеников'],
  ['curator1', 'Сводка по моим классам', ''],
  ['specialist1', 'Во сколько начинаются уроки?', '08:30'],
  ['student1', 'Мои оценки', 'Оценки по предметам'],
  ['parent1', 'Расскажи про моего ребёнка', 'куратор'],
  ['accountant1', 'Сводка по финансам', 'Начислено'],
  ['psychologist1', 'Во сколько начинаются уроки?', '08:30'],
  ['doctor1', 'Во сколько обед у детей?', 'обед'],
  ['hr1', 'Сколько учеников в школе?', 'Педагогов'],
  ['librarian1', 'Во сколько начинаются уроки?', '08:30'],
  ['cook1', 'Во сколько обед у детей?', 'обед'],
  ['zavhoz1', 'Режим работы школы', 'работает'],
];

// негативные проверки: роль НЕ должна получить данные
const NEGATIVE = [
  ['matematik', 'Сводка по финансам', 'нет доступа'],
  ['cook1', 'Сколько учеников в школе?', ''], // ждём подсказки, не цифры всей школы
];

async function loginCookies(login) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const cookies = csrfRes.headers.getSetCookie().map((c) => c.split(';')[0]);
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookies.join('; ') },
    body: new URLSearchParams({ csrfToken, login, password: PASS, redirect: 'false' }),
    redirect: 'manual',
  });
  res.headers.getSetCookie().forEach((c) => cookies.push(c.split(';')[0]));
  return cookies.join('; ');
}

async function ask(cookie, message) {
  const res = await fetch(`${BASE}/api/v1/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) return `HTTP ${res.status}`;
  const j = await res.json();
  return j.success ? j.data.reply : 'ERR ' + JSON.stringify(j.error);
}

// логин лимитирован 10/мин с IP — между ролями пауза
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
for (const [login, q, expect] of CASES) {
  try {
    await wait(7000);
    const cookie = await loginCookies(login);
    const reply = await ask(cookie, q);
    const ok = reply.length > 15 && !reply.startsWith('HTTP') && (!expect || reply.includes(expect));
    console.log(`${ok ? '✅' : '❌'} ${login}: "${q}" → ${reply.replace(/\n/g, ' ').slice(0, 90)}`);
    if (ok) pass++;
  } catch (e) {
    console.log(`💥 ${login}: ${e.message.slice(0, 80)}`);
  }
}
console.log('\n--- негативные (доступ должен быть закрыт) ---');
for (const [login, q] of NEGATIVE) {
  await wait(7000);
  const cookie = await loginCookies(login);
  const reply = await ask(cookie, q);
  console.log(`🔒 ${login}: "${q}" → ${reply.replace(/\n/g, ' ').slice(0, 110)}`);
}
console.log(`\n===== ассистент: ${pass}/${CASES.length} PASS =====`);
