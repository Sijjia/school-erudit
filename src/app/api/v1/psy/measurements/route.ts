import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES, PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';

type Rule = { op?: string; factor?: number } | null;
function applyRule(value: number, rule: Rule): number {
  if (!rule || !rule.op || !rule.factor) return value;
  if (rule.op === 'divide') return value / rule.factor;
  if (rule.op === 'multiply') return value * rule.factor;
  return value;
}

/**
 * GET /api/v1/psy/measurements?caseId= — точки динамики «до/после».
 * Патч аналитического коллапса: значения из НОВЫХ версий методики нормализуются
 * к базовой шкале через mappingRule версии, чтобы графики склеивались корректно.
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;
  const caseId = new URL(request.url).searchParams.get('caseId');
  if (!caseId) return errorResponse('VALIDATION_ERROR', 'Параметр caseId обязателен');

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, caseId))) return errorResponse('FORBIDDEN', 'Нет доступа', 403);

  try {
    const points = await prisma.psyMeasurement.findMany({ where: { caseId }, orderBy: { date: 'asc' } });
    const tplIds = [...new Set(points.map((p) => p.templateId).filter(Boolean) as string[])];
    const tpls = tplIds.length
      ? await prisma.psyDiagnosticTemplate.findMany({ where: { id: { in: tplIds } }, select: { id: true, mappingRule: true } })
      : [];
    const ruleOf = (id: string | null) => (id ? (tpls.find((t) => t.id === id)?.mappingRule as Rule) : null);

    const result = points.map((p) => ({
      id: p.id, metric: p.metric, date: p.date,
      value: p.value,
      normalized: Math.round(applyRule(p.value, ruleOf(p.templateId)) * 100) / 100,
      templateVersion: p.templateVersion,
    }));
    return successResponse(result);
  } catch (e) {
    console.error('GET psy/measurements error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить динамику', 500);
  }
}

/** POST /api/v1/psy/measurements — добавить точку динамики. */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const { caseId, metric, value, date, templateId, templateVersion } = body as Record<string, unknown>;
  if (!caseId || !metric || value === undefined || value === null) {
    return errorResponse('VALIDATION_ERROR', 'Нужны caseId, metric и value');
  }
  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, String(caseId)))) return errorResponse('FORBIDDEN', 'Нет доступа', 403);

  try {
    const created = await prisma.psyMeasurement.create({
      data: {
        caseId: String(caseId), metric: String(metric), value: parseInt(String(value), 10),
        date: date ? new Date(String(date)) : new Date(),
        templateId: templateId ? String(templateId) : null,
        templateVersion: templateVersion ? Number(templateVersion) : 1,
      },
    });
    return successResponse(created, 201);
  } catch (e) {
    console.error('POST psy/measurements error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось добавить точку', 500);
  }
}
