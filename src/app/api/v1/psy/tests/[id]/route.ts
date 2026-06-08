import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';

/** PATCH /api/v1/psy/tests/[id] — правка черновика заключения + верификация психологом. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const test = await prisma.psyTestResult.findUnique({ where: { id }, select: { caseId: true } });
  if (!test) return errorResponse('NOT_FOUND', 'Тест не найден', 404);

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, test.caseId))) return errorResponse('FORBIDDEN', 'Нет доступа', 403);

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.aiInterpretation === 'string') data.aiInterpretation = body.aiInterpretation;
  if (body.isHumanVerified === true) data.isHumanVerified = true;
  if (body.isHumanVerified === false) data.isHumanVerified = false;
  if (Object.keys(data).length === 0) return errorResponse('VALIDATION_ERROR', 'Нет полей для обновления');

  try {
    const updated = await prisma.psyTestResult.update({ where: { id }, data });
    return successResponse(updated);
  } catch (e) {
    console.error('PATCH psy/tests/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить', 500);
  }
}
