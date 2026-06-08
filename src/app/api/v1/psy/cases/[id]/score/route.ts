import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';

/**
 * POST /api/v1/psy/cases/[id]/score — авто-расчёт шкалы из сырых баллов методики.
 * Принимает ответы по шкальным вопросам → считает сумму → сохраняет как замер
 * динамики (PsyMeasurement) + результат теста (PsyTestResult).
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, id))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

  const body = await request.json().catch(() => ({}));
  const { templateId, answers, date } = body as { templateId?: string; answers?: number[]; date?: string };
  if (!templateId || !Array.isArray(answers)) return errorResponse('VALIDATION_ERROR', 'Нужны templateId и answers[]');

  const tpl = await prisma.psyDiagnosticTemplate.findUnique({ where: { id: templateId } });
  if (!tpl) return errorResponse('NOT_FOUND', 'Методика не найдена', 404);

  const schema = (tpl.schema as { metric?: string }) ?? {};
  const metric = schema.metric || tpl.name;
  // сырой балл = сумма ответов по шкальным вопросам
  const rawTotal = answers.reduce((s, v) => s + (Number(v) || 0), 0);

  try {
    const when = date ? new Date(date) : new Date();
    const [measurement, test] = await prisma.$transaction([
      prisma.psyMeasurement.create({
        data: { caseId: id, metric, value: rawTotal, templateId, templateVersion: tpl.version, date: when },
      }),
      prisma.psyTestResult.create({
        data: {
          caseId: id, templateId, templateVersion: tpl.version,
          rawScores: { answers }, computedScales: { metric, total: rawTotal },
          isHumanVerified: true, date: when,
        },
      }),
    ]);
    return successResponse({ measurement, test, total: rawTotal }, 201);
  } catch (e) {
    console.error('POST psy/cases/[id]/score error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить результат', 500);
  }
}
