// Ждёт нового билда на проде и проверяет новые учительские эндпоинты как matematik.
const BASE = process.argv[2] || 'https://bilimos.kg';
let cookies = {};
const setC = (res) => { for (const c of res.headers.getSetCookie?.() || []) { const [p] = c.split(';'); const i = p.indexOf('='); cookies[p.slice(0, i)] = p.slice(i + 1); } };
const ch = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
const get = async (p) => { const r = await fetch(BASE + p, { headers: { cookie: ch() }, redirect: 'manual' }); setC(r); return r; };
const post = async (p, body) => { const r = await fetch(BASE + p, { method: 'POST', headers: { cookie: ch(), 'content-type': 'application/json' }, body: JSON.stringify(body), redirect: 'manual' }); setC(r); return r; };

async function login() {
  const c = await get('/api/auth/csrf'); const { csrfToken } = await c.json();
  await fetch(BASE + '/api/auth/callback/credentials', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: ch() }, body: new URLSearchParams({ csrfToken, login: 'matematik', password: 'erudit2025', json: 'true' }), redirect: 'manual' }).then(setC);
  const s = await (await get('/api/auth/session')).json();
  return s?.user || null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const verdict = (s) => s === 200 || s === 201 ? '✅' : s === 403 ? '⛔403' : s === 404 ? '❌404' : `❓${s}`;

(async () => {
  if (!await login()) { console.error('LOGIN FAILED (старый билд ещё крутится?)'); }
  // ждём новый билд: /api/v1/lesson-plans должен отвечать (не 404)
  let live = false;
  for (let i = 1; i <= 30; i++) {
    await login();
    const r = await get('/api/v1/lesson-plans');
    console.log(`[${i * 20}s] /lesson-plans -> ${r.status}`);
    if (r.status !== 404) { live = true; break; }
    await sleep(20000);
  }
  if (!live) { console.log('Новый билд не поднялся за отведённое время.'); process.exit(0); }

  console.log('\n=== Проверка новых учительских функций ===');
  console.log(verdict((await get('/api/v1/curriculum-plan/options')).status), 'КТП: опции (предметы/классы)');
  console.log(verdict((await get('/api/v1/curriculum-plan/plans')).status), 'КТП: список планов');
  console.log(verdict((await get('/api/v1/lesson-plans')).status), 'Поурочные планы: список');
  const gen = await post('/api/v1/lesson-plans/generate', { topic: 'Законы Ньютона', subject: 'Физика', gradeLevel: '8 класс', duration: 45 });
  const gj = await gen.json().catch(() => null);
  console.log(verdict(gen.status), `Поурочный план: ИИ-генерация (модель: ${gj?.data?.model ?? '?'}, этапов: ${gj?.data?.stages?.length ?? 0})`);
  // посещаемость: возьмём ученика и поставим present
  const sj = await (await get('/api/v1/students')).json();
  const sid = (Array.isArray(sj?.data) ? sj.data : sj?.data?.items)?.[0]?.id;
  if (sid) {
    const today = new Date().toISOString().slice(0, 10);
    console.log(verdict((await post('/api/v1/attendance', { studentId: sid, date: today, status: 'present' })).status), 'Посещаемость: отметка present');
  }
  console.log(verdict((await get('/api/v1/library')).status), 'Библиотека: чтение');
})();
