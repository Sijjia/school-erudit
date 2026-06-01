// Полная e2e-проверка 3 сценариев агента. Действия — через API, проверка
// получателей — прямой инспекцией AgentItem в Neon (HTTP-драйвер).
// Запуск: DATABASE_URL="<pooled neon>" node scripts/verify-agent-full.mjs [baseUrl]
import { neon } from '@neondatabase/serverless';

const BASE = process.argv[2] || 'https://bilimos.kg';
const db = neon(process.env.DATABASE_URL);

let cookies = {};
const setC = (r) => { for (const c of r.headers.getSetCookie?.() || []) { const [p] = c.split(';'); const i = p.indexOf('='); cookies[p.slice(0, i)] = p.slice(i + 1); } };
const ch = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
const get = async (p) => { const r = await fetch(BASE + p, { headers: { cookie: ch() }, redirect: 'manual' }); setC(r); return r; };
const post = async (p, b) => { const r = await fetch(BASE + p, { method: 'POST', headers: { cookie: ch(), 'content-type': 'application/json' }, body: JSON.stringify(b), redirect: 'manual' }); setC(r); return r; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(loginName, password) {
  cookies = {};
  const { csrfToken } = await (await get('/api/auth/csrf')).json();
  await fetch(BASE + '/api/auth/callback/credentials', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: ch() }, body: new URLSearchParams({ csrfToken, login: loginName, password, json: 'true' }), redirect: 'manual' }).then(setC);
  return (await (await get('/api/auth/session')).json())?.user || null;
}
const recent = `AND "createdAt" > now() - interval '3 minutes'`;
const roleOf = async (uid) => (await db`SELECT role FROM "User" WHERE id = ${uid}`)[0]?.role ?? '?';

(async () => {
  // ждём новый билд
  for (let i = 1; i <= 30; i++) {
    await login('matematik', 'erudit2025');
    const r = await get('/api/v1/agent/items');
    if (r.status !== 404) { console.log(`Билд live на ${i * 20}s`); break; }
    if (i === 30) { console.log('Билд не поднялся'); process.exit(0); }
    await sleep(20000);
  }

  const teacher = await login('matematik', 'erudit2025');
  const teacherUserId = teacher.id;

  // ── Сценарий 1: низкая оценка ──
  console.log('\n=== Сценарий 1: низкая оценка ("2") ===');
  const s1 = (await db`
    SELECT s.id AS sid, ts."subjectId" AS subj
    FROM "TeacherSubject" ts
    JOIN "Teacher" t ON t.id = ts."teacherId"
    JOIN "User" u ON u.id = t."userId"
    JOIN "Student" s ON s."classId" = ts."classId"
    JOIN "ParentStudent" ps ON ps."studentId" = s.id
    WHERE u.login = 'matematik' LIMIT 1`)[0];
  if (!s1) { console.log('  ⚠ нет ученика с родителем в классах matematik — пропуск'); }
  else {
    const teacherId = (await get('/api/v1/me').then((r) => r.json()))?.data?.teacherId;
    const categoryId = (await get('/api/v1/grading/categories').then((r) => r.json()))?.data?.[0]?.id;
    const periodId = (await get('/api/v1/periods').then((r) => r.json()))?.data?.find((p) => p.isActive)?.id
      ?? (await get('/api/v1/periods').then((r) => r.json()))?.data?.[0]?.id;
    const g = await post('/api/v1/grading', { studentId: s1.sid, subjectId: s1.subj, categoryId, teacherId, periodId, value: 2, scale: 'FIVE', date: new Date().toISOString().slice(0, 10), comment: 'agent e2e' });
    console.log('  POST оценки "2":', g.status);
    await sleep(1500);
    const items = await db.query(`SELECT kind, "forUserId" FROM "AgentItem" WHERE "studentId"=$1 AND "ruleKey"='low-grade-parent-alert' ${recent}`, [s1.sid]);
    const parents = (await db.query(`SELECT p."userId" AS uid FROM "ParentStudent" ps JOIN "Parent" p ON p.id=ps."parentId" WHERE ps."studentId"=$1`, [s1.sid])).map((x) => x.uid);
    const taskToTeacher = items.find((it) => it.kind === 'task' && it.forUserId === teacherUserId);
    const alertToParent = items.find((it) => it.kind === 'alert' && parents.includes(it.forUserId));
    console.log(`  ${taskToTeacher ? '✅' : '❌'} task учителю (forUser=matematik)`);
    console.log(`  ${alertToParent ? '✅' : '❌'} alert родителю (forUser=родитель, роль=${alertToParent ? await roleOf(alertToParent.forUserId) : '—'})`);
  }

  // ── Сценарий 2: пропуски ──
  console.log('\n=== Сценарий 2: 3+ пропуска → только куратор ===');
  const s2 = (await db`
    SELECT s.id AS sid, t."userId" AS curatoruser
    FROM "Student" s JOIN "Class" c ON c.id = s."classId"
    JOIN "Teacher" t ON t.id = c."curatorId" LIMIT 1`)[0];
  if (!s2) { console.log('  ⚠ нет класса с куратором — пропуск'); }
  else {
    for (let d = 0; d < 3; d++) {
      const dt = new Date(); dt.setDate(dt.getDate() - d);
      await post('/api/v1/attendance', { studentId: s2.sid, date: dt.toISOString().slice(0, 10), status: 'absent' });
    }
    await sleep(1500);
    const items = await db.query(`SELECT kind, "forUserId" FROM "AgentItem" WHERE "studentId"=$1 AND "ruleKey"='absence-streak-curator' ${recent}`, [s2.sid]);
    const toCurator = items.find((it) => it.forUserId === s2.curatoruser);
    const others = items.filter((it) => it.forUserId !== s2.curatoruser);
    console.log(`  ${toCurator ? '✅' : '❌'} alert куратору (роль=${toCurator ? await roleOf(toCurator.forUserId) : '—'})`);
    console.log(`  ${others.length === 0 ? '✅' : '❌'} НЕ ушло никому кроме куратора (лишних: ${others.length})`);
  }

  // ── Сценарий 3: проваленный тест → только ученик ──
  console.log('\n=== Сценарий 3: тест <50% → совет ученику (учитель без спама) ===');
  const stu = await login('student90', 'erudit2025');
  if (!stu) { console.log('  ⚠ не удалось войти student90 — пропуск'); }
  else {
    const tests = (await get('/api/v1/tests').then((r) => r.json()))?.data ?? [];
    const test = Array.isArray(tests) ? tests.find((t) => t.status === 'published') : null;
    if (!test) { console.log('  ⚠ нет опубликованного теста для ученика — пропуск'); }
    else {
      const full = (await get(`/api/v1/tests/${test.id}`).then((r) => r.json()))?.data;
      const answers = {};
      for (const q of full?.questions ?? []) answers[q.id] = ['__wrong__'];
      const sub = await post(`/api/v1/tests/${test.id}/submit`, { answers });
      const sj = await sub.json();
      console.log(`  Сдан тест: ${sj?.data?.score}/${sj?.data?.maxScore}`);
      await sleep(1500);
      const sid = (await db`SELECT id FROM "Student" WHERE "userId"=${stu.id}`)[0]?.id;
      const items = await db.query(`SELECT kind, "forUserId" FROM "AgentItem" WHERE "studentId"=$1 AND "ruleKey"='test-failed-remedial' ${recent}`, [sid]);
      const toStudent = items.find((it) => it.forUserId === stu.id);
      console.log(`  ${toStudent ? '✅' : '❌'} suggestion ученику (роль=${toStudent ? await roleOf(toStudent.forUserId) : '—'})`);
      console.log(`  ${items.every((it) => it.forUserId === stu.id) ? '✅' : '❌'} учитель НЕ получил спам по этому правилу`);
    }
  }
  console.log('\nГотово.');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
