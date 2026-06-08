import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';

/**
 * PATCH /api/v1/psy/sessions/[id]
 * Редактирование DAP-полей и/или верификация (anti-hallucination gate):
 * isHumanVerified=true разрешается только если заполнен хотя бы один DAP-раздел.
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const session = await prisma.psySession.findUnique({ where: { id }, select: { caseId: true, dapData: true, dapAssessment: true, dapPlan: true } });
  if (!session) return errorResponse('NOT_FOUND', 'Сессия не найдена', 404);

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, session.caseId))) {
    return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);
  }

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const f of ['rawNote', 'dapData', 'dapAssessment', 'dapPlan', 'qualNote'] as const) {
    if (typeof body[f] === 'string') data[f] = body[f];
  }

  if (body.isHumanVerified === true) {
    const dapData = (data.dapData ?? session.dapData) as string | null;
    const dapAssessment = (data.dapAssessment ?? session.dapAssessment) as string | null;
    const dapPlan = (data.dapPlan ?? session.dapPlan) as string | null;
    if (!dapData?.trim() && !dapAssessment?.trim() && !dapPlan?.trim()) {
      return errorResponse('VALIDATION_ERROR', 'Нельзя завершить сессию без заполненного DAP');
    }
    data.isHumanVerified = true;
    data.verifiedAt = new Date();
  } else if (body.isHumanVerified === false) {
    data.isHumanVerified = false;
    data.verifiedAt = null;
  }

  if (Object.keys(data).length === 0) return errorResponse('VALIDATION_ERROR', 'Нет полей для обновления');

  try {
    const updated = await prisma.psySession.update({ where: { id }, data });
    return successResponse(updated);
  } catch (e) {
    console.error('PATCH psy/sessions/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить сессию', 500);
  }
}
