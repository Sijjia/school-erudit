import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/students/[id]/timeline — единая лента событий ученика из разных
 * ролей («вся школа взаимосвязана»). ПРИВАТНОСТЬ: содержание психологических
 * сессий НЕ раскрывается — только факт «сессия проведена».
 */
type Item = { date: string; type: string; title: string; detail?: string; source: string };

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  try {
    const [student, notes, invoices, incidents, psySessions] = await Promise.all([
      prisma.student.findUnique({ where: { id }, select: { enrolledAt: true } }),
      prisma.studentNote.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.feeInvoice.findMany({ where: { studentId: id }, include: { payments: true }, orderBy: { createdAt: 'desc' }, take: 30 }),
      prisma.behaviorIncident.findMany({ where: { studentId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.psySession.findMany({ where: { case: { studentId: id } }, select: { date: true }, orderBy: { date: 'desc' }, take: 20 }),
    ]);

    const items: Item[] = [];

    for (const n of notes) {
      items.push({ date: n.createdAt.toISOString(), type: n.type, title: noteTitle(n.type), detail: n.text, source: n.role });
    }
    for (const inv of invoices) {
      for (const pay of inv.payments) {
        items.push({ date: pay.paidAt.toISOString(), type: 'finance', title: 'Оплата', detail: `${pay.amount} сом${pay.method ? ' · ' + pay.method : ''} — «${inv.title}»`, source: 'бухгалтерия' });
      }
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      if (inv.status !== 'paid' && inv.dueDate && inv.dueDate < new Date() && paid < inv.amount) {
        items.push({ date: inv.dueDate.toISOString(), type: 'overdue', title: 'Просрочка оплаты', detail: `«${inv.title}» — осталось ${inv.amount - paid} сом`, source: 'финансы' });
      }
    }
    for (const inc of incidents) {
      items.push({ date: inc.createdAt.toISOString(), type: 'behavior', title: 'Поведение', detail: inc.description, source: 'воспитательная часть' });
    }
    for (const s of psySessions) {
      // только факт, без содержания (конфиденциально)
      items.push({ date: s.date.toISOString(), type: 'psych', title: 'Психолог: сессия проведена', source: 'психолог' });
    }
    if (student?.enrolledAt) {
      items.push({ date: student.enrolledAt.toISOString(), type: 'status', title: 'Зачислен в школу', source: 'приёмная' });
    }

    items.sort((a, b) => (a.date < b.date ? 1 : -1));
    return successResponse(items.slice(0, 120));
  } catch (e) {
    console.error('GET student timeline error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить ленту', 500);
  }
}

function noteTitle(type: string): string {
  return { promise: 'Обещание оплаты', call: 'Звонок', status: 'Статус', finance: 'Финансы', psych: 'Психолог', note: 'Заметка' }[type] ?? 'Заметка';
}
