import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';
import { notifyUser } from '@/shared/lib/agent/notify';

/**
 * POST /api/v1/psy/cases/[id]/course — завершить раунд курса (≈6 сессий) с исходом.
 * - improved → кейс закрывается.
 * - repeat   → новый раунд (courseRound++); если ≥2 раундов без улучшения —
 *   уведомление старшему психологу.
 * - referred → создаётся направление к узкому специалисту + уведомление старшему.
 */
const TARGETS = ['psychiatrist', 'speech', 'medical', 'other'];

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, id))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

  const c = await prisma.psyCase.findUnique({ where: { id }, select: { courseRound: true, title: true } });
  if (!c) return errorResponse('NOT_FOUND', 'Кейс не найден', 404);

  const body = await request.json().catch(() => ({}));
  const { outcome, courseSummary, referralTarget, referralNote } = body as Record<string, string>;
  if (!['improved', 'repeat', 'referred'].includes(outcome)) {
    return errorResponse('VALIDATION_ERROR', 'outcome: improved | repeat | referred');
  }

  try {
    const data: Record<string, unknown> = { outcome, summary: courseSummary ?? undefined };

    if (outcome === 'improved') {
      data.status = 'closed';
      data.closedAt = new Date();
    } else if (outcome === 'repeat') {
      data.courseRound = c.courseRound + 1;
      data.outcome = 'in_progress';
      data.status = 'in_progress';
    } else if (outcome === 'referred') {
      data.status = 'paused';
      await prisma.psyReferral.create({
        data: { caseId: id, target: TARGETS.includes(referralTarget) ? referralTarget : 'other', note: referralNote || null, createdBy: auth.session.user.id },
      });
    }

    const updated = await prisma.psyCase.update({ where: { id }, data });

    // Уведомление старшему психологу: эскалация или исчерпание методик (≥2 раунда).
    const notifySenior = outcome === 'referred' || (outcome === 'repeat' && c.courseRound + 1 >= 2);
    if (notifySenior) {
      const seniors = await prisma.user.findMany({ where: { role: 'senior_psychologist', isActive: true }, select: { id: true } });
      const msg = outcome === 'referred'
        ? `Кейс «${c.title}»: направление к специалисту (${referralTarget || 'other'}).`
        : `Кейс «${c.title}»: ${c.courseRound + 1}-й раунд методик без явного улучшения — нужен ваш взгляд.`;
      await Promise.all(seniors.map((s) => notifyUser(s.id, '🧠 Психологическая служба', msg)));
    }

    return successResponse(updated);
  } catch (e) {
    console.error('POST psy/cases/[id]/course error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось завершить курс', 500);
  }
}
