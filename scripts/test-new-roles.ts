/** Проверка зон новых ролей. Запуск: npx tsx scripts/test-new-roles.ts */
import { PrismaClient } from '@prisma/client';
import { resolveScope } from '../src/shared/lib/ai/scope';
import { executeTool } from '../src/shared/lib/ai/tools';

const p = new PrismaClient();
const short = (s: string, n = 180) => (s.length > n ? s.slice(0, n) + '…' : s);

async function scopeFor(login: string) {
  const u = await p.user.findUnique({ where: { login } });
  if (!u) throw new Error(`нет пользователя ${login}`);
  return resolveScope({ id: u.id, login: u.login, role: u.role, starLevel: 1 });
}

async function main() {
  const psyStudent = await p.specialistSession.findFirst({ where: { kind: 'psych' }, select: { studentId: true } });
  const medStudent = await p.specialistSession.findFirst({ where: { kind: 'medical' }, select: { studentId: true } });

  const acc = await scopeFor('accountant1');
  console.log('БУХГАЛТЕР финансы:', short(await executeTool('finance_summary', {}, acc)));
  if (psyStudent) console.log('БУХГАЛТЕР психолог (ждём отказ):', await executeTool('student_psych', { studentId: psyStudent.studentId }, acc));

  const psy = await scopeFor('psychologist1');
  if (psyStudent) console.log('ПСИХОЛОГ psych-данные:', short(await executeTool('student_psych', { studentId: psyStudent.studentId }, psy), 220));
  if (medStudent) console.log('ПСИХОЛОГ про medical-ученика (psych-only):', short(await executeTool('student_psych', { studentId: medStudent.studentId }, psy), 220));
  console.log('ПСИХОЛОГ финансы (ждём отказ):', await executeTool('finance_summary', {}, psy));

  const doc = await scopeFor('doctor1');
  if (medStudent) console.log('ВРАЧ medical:', short(await executeTool('student_psych', { studentId: medStudent.studentId }, doc), 220));
  if (psyStudent) console.log('ВРАЧ про psych-ученика (psych видеть не должен):', short(await executeTool('student_psych', { studentId: psyStudent.studentId }, doc), 220));

  const cook = await scopeFor('cook1');
  console.log('ПОВАР школа (ждём отказ):', await executeTool('school_overview', {}, cook));
  console.log('ПОВАР база знаний:', short(await executeTool('school_knowledge', { query: 'во сколько обед у детей' }, cook)));

  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
