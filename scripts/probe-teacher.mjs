// Логинится на прод как учитель (matematik) и проверяет доступ к спорным разделам.
// Запуск: node scripts/probe-teacher.mjs [baseUrl]
const BASE = process.argv[2] || 'https://bilimos.kg';
const LOGIN = 'matematik';
const PASSWORD = 'erudit2025';

let cookies = {};
function setCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    cookies[pair.slice(0, idx)] = pair.slice(idx + 1);
  }
}
function cookieHeader() {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function get(path) {
  const res = await fetch(BASE + path, { headers: { cookie: cookieHeader() }, redirect: 'manual' });
  setCookies(res);
  return res;
}

async function login() {
  const csrfRes = await get('/api/auth/csrf');
  setCookies(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const body = new URLSearchParams({ csrfToken, login: LOGIN, password: PASSWORD, json: 'true' });
  const res = await fetch(BASE + '/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader() },
    body,
    redirect: 'manual',
  });
  setCookies(res);
  const session = await get('/api/auth/session');
  const sj = await session.json();
  return sj?.user || null;
}

async function probe(label, path) {
  try {
    const res = await get(path);
    let note = '';
    if (res.headers.get('content-type')?.includes('json')) {
      const j = await res.json().catch(() => null);
      if (j && j.success === false) note = `error=${j.error?.code}`;
      else if (j && Array.isArray(j.data)) note = `items=${j.data.length}`;
      else if (j && j.data?.items) note = `items=${j.data.items.length}`;
    }
    const verdict = res.status === 200 ? '✅ ДОСТУП' : res.status === 403 ? '⛔ 403' : res.status === 401 ? '🔒 401' : `❓ ${res.status}`;
    console.log(`${verdict}  ${label.padEnd(34)} ${path}  ${note}`);
    return res.status;
  } catch (e) {
    console.log(`💥 ERR    ${label}  ${e.message}`);
    return 0;
  }
}

(async () => {
  const user = await login();
  if (!user) { console.error('LOGIN FAILED'); process.exit(1); }
  console.log(`Вошёл как: ${user.login} (роль: ${user.role}, ★${user.starLevel})\n`);

  await probe('КТП (GET)', '/api/v1/curriculum-plan');
  await probe('Посещаемость (GET)', '/api/v1/attendance?date=2026-06-01');
  await probe('Список учеников', '/api/v1/students');
  // карточку конкретного ученика проверим, взяв id из списка
  const sres = await get('/api/v1/students');
  const sj = await sres.json().catch(() => null);
  const sid = (Array.isArray(sj?.data) ? sj.data : sj?.data?.items)?.[0]?.id;
  if (sid) await probe('Карточка ученика', `/api/v1/students/${sid}`);
  else console.log('❓ нет id ученика для проверки карточки');
  await probe('Библиотека', '/api/v1/library');
  await probe('Аналитика (общая)', '/api/v1/dashboard/analytics');
  await probe('ИИ-презентации (новое)', '/api/v1/ai/presentations');
})();
