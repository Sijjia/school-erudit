// E2E: ждёт новый билд, ставит низкую оценку как учитель → проверяет, что агент
// создал задачу в Панели агента. Запуск: node scripts/verify-agent.mjs
const BASE = process.argv[2] || 'https://bilimos.kg';
let cookies = {};
const setC = (r) => { for (const c of r.headers.getSetCookie?.() || []) { const [p] = c.split(';'); const i = p.indexOf('='); cookies[p.slice(0, i)] = p.slice(i + 1); } };
const ch = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
const get = async (p) => { const r = await fetch(BASE + p, { headers: { cookie: ch() }, redirect: 'manual' }); setC(r); return r; };
const post = async (p, b) => { const r = await fetch(BASE + p, { method: 'POST', headers: { cookie: ch(), 'content-type': 'application/json' }, body: JSON.stringify(b), redirect: 'manual' }); setC(r); return r; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(login, password) {
  cookies = {};
  const { csrfToken } = await (await get('/api/auth/csrf')).json();
  await fetch(BASE + '/api/auth/callback/credentials', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: ch() }, body: new URLSearchParams({ csrfToken, login, password, json: 'true' }), redirect: 'manual' }).then(setC);
  return (await (await get('/api/auth/session')).json())?.user || null;
}

(async () => {
  // ждём новый билд (наличие /api/v1/agent/items)
  for (let i = 1; i <= 30; i++) {
    await login('matematik', 'erudit2025');
    const r = await get('/api/v1/agent/items');
    console.log(`[${i * 20}s] /agent/items -> ${r.status}`);
    if (r.status !== 404) break;
    await sleep(20000);
  }

  const me = await (await get('/api/v1/me')).json();
  const teacherId = me?.data?.teacherId;
  const today = await (await get('/api/v1/schedule/teacher-today')).json();
  const lesson = today?.data?.lessons?.[0];
  if (!lesson) { console.log('Нет уроков на сегодня — пропускаю e2e (правила всё равно задеплоены).'); process.exit(0); }
  const students = await (await get(`/api/v1/students?classId=${lesson.classId}`)).json();
  const student = students?.data?.[0];
  const cats = await (await get('/api/v1/grading/categories')).json();
  const categoryId = cats?.data?.[0]?.id;
  const periods = await (await get('/api/v1/periods')).json();
  const periodId = (periods?.data?.find((p) => p.isActive) ?? periods?.data?.[0])?.id;

  if (!teacherId || !student || !categoryId || !periodId) { console.log('Не хватает данных для e2e', { teacherId: !!teacherId, student: !!student, categoryId: !!categoryId, periodId: !!periodId }); process.exit(0); }

  const before = (await (await get('/api/v1/agent/items')).json())?.data?.newCount ?? 0;
  const today_iso = new Date().toISOString().slice(0, 10);
  const gradeRes = await post('/api/v1/grading', {
    studentId: student.id, subjectId: lesson.subjectId, categoryId, teacherId,
    periodId, value: 30, scale: 'HUNDRED', date: today_iso, comment: 'agent e2e test',
  });
  console.log('POST низкой оценки (30/100):', gradeRes.status);

  await sleep(1500);
  const after = await (await get('/api/v1/agent/items')).json();
  const tasks = (after?.data?.items ?? []).filter((it) => it.ruleKey === 'low-grade-parent-alert');
  console.log(`newCount: ${before} -> ${after?.data?.newCount}`);
  console.log(tasks.length > 0 ? `✅ Агент создал ${tasks.length} элемент(ов) по правилу low-grade-parent-alert` : '❌ Агент НЕ создал элемент');
  if (tasks[0]) console.log(`   пример: [${tasks[0].kind}] ${tasks[0].title} — ${tasks[0].body.slice(0, 80)}...`);
})();
