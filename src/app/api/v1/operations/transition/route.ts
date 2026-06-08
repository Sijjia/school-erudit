import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * POST /api/v1/operations/transition — перевод учебного года.
 * mode=analyze → что произойдёт (предпросмотр); mode=apply → выполнить:
 * ученики поднимаются по лестнице (класс grade+1, та же буква/филиал), последний
 * класс → выпускники; опционально продлеваются договоры (новый со связью на старый).
 */
const ROLES = ['super_admin', 'analyst', 'zavuch', 'secretary'] as const;
const ACTIVE = ['permanent', 'conditional', 'repeating'] as const;

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const mode = body.mode === 'apply' ? 'apply' : 'analyze';
  const year = String(body.year ?? '');
  const renewContracts = body.renewContracts === true;

  try {
    const classes = await prisma.class.findMany({ select: { id: true, grade: true, letter: true, branchId: true, levelId: true } });
    if (classes.length === 0) return errorResponse('VALIDATION_ERROR', 'Нет классов');
    const maxGrade = Math.max(...classes.map((c) => c.grade));
    const levels = await prisma.schoolLevel.findMany({ select: { id: true, fromGrade: true, toGrade: true } });
    const counts = await prisma.student.groupBy({ by: ['classId'], where: { status: { in: [...ACTIVE] } }, _count: true });
    const countOf = (cid: string) => counts.find((c) => c.classId === cid)?._count ?? 0;

    // ── analyze: предпросмотр ──
    if (mode === 'analyze') {
      const moves = classes.map((c) => {
        const target = c.grade >= maxGrade ? null : classes.find((t) => t.grade === c.grade + 1 && t.letter === c.letter && t.branchId === c.branchId);
        return {
          from: `${c.grade}${c.letter}`, students: countOf(c.id),
          to: c.grade >= maxGrade ? 'Выпуск' : `${c.grade + 1}${c.letter}`,
          targetExists: c.grade >= maxGrade ? true : !!target,
        };
      }).filter((m) => m.students > 0).sort((a, b) => a.from.localeCompare(b.from));
      const graduates = moves.filter((m) => m.to === 'Выпуск').reduce((s, m) => s + m.students, 0);
      const promoted = moves.filter((m) => m.to !== 'Выпуск').reduce((s, m) => s + m.students, 0);
      return successResponse({ mode, moves, graduates, promoted });
    }

    // ── apply: выполняем (классы по убыванию grade, чтобы не двигать дважды) ──
    let graduated = 0, promoted = 0, renewed = 0, createdClasses = 0;
    for (const c of [...classes].sort((a, b) => b.grade - a.grade)) {
      const students = await prisma.student.findMany({ where: { classId: c.id, status: { in: [...ACTIVE] } }, select: { id: true } });
      if (students.length === 0) continue;
      const ids = students.map((s) => s.id);

      if (c.grade >= maxGrade) {
        await prisma.student.updateMany({ where: { id: { in: ids } }, data: { status: 'graduated' } });
        graduated += ids.length;
        continue;
      }
      let target = classes.find((t) => t.grade === c.grade + 1 && t.letter === c.letter && t.branchId === c.branchId);
      if (!target) {
        const lvl = levels.find((l) => l.fromGrade <= c.grade + 1 && l.toGrade >= c.grade + 1) ?? { id: c.levelId };
        const nc = await prisma.class.create({ data: { grade: c.grade + 1, letter: c.letter, levelId: lvl.id, branchId: c.branchId } });
        target = { id: nc.id, grade: nc.grade, letter: nc.letter, branchId: nc.branchId, levelId: nc.levelId };
        classes.push(target);
        createdClasses++;
      }
      await prisma.student.updateMany({ where: { id: { in: ids } }, data: { classId: target.id } });
      promoted += ids.length;

      if (renewContracts) {
        for (const sid of ids) {
          const prev = await prisma.contract.findFirst({ where: { studentId: sid, status: 'active' }, orderBy: { createdAt: 'desc' } });
          if (!prev) continue;
          await prisma.contract.update({ where: { id: prev.id }, data: { status: 'completed' } });
          await prisma.contract.create({
            data: {
              studentId: sid, number: `${prev.number}-${year || 'next'}`, year: year || prev.year,
              baseAmount: prev.baseAmount, discountPct: prev.discountPct, discountNote: prev.discountNote,
              amount: prev.amount, prepaymentPct: prev.prepaymentPct, scheduleType: prev.scheduleType,
              scheduleMonths: prev.scheduleMonths, paymentDay: prev.paymentDay,
              representative: prev.representative ?? undefined, requisites: prev.requisites ?? undefined,
              branchId: prev.branchId, prevContractId: prev.id, createdById: auth.session.user.id, status: 'active',
            },
          });
          renewed++;
        }
      }
    }
    return successResponse({ mode, graduated, promoted, renewed, createdClasses });
  } catch (e) {
    console.error('POST operations/transition error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось выполнить перевод года', 500);
  }
}
