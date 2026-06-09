import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, caseWhereForScope, CASE_OWNER_ROLES, PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';
import { emitSafeguardingAlert } from '@/shared/lib/psy-safeguarding';
import { emitEvent } from '@/shared/lib/agent/engine';

/** GET /api/v1/psy/cases?studentId=&status=&riskLevel= — список кейсов под RLS. */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  const where = await caseWhereForScope(scope);

  const { searchParams } = new URL(request.url);
  for (const p of ['studentId', 'status', 'riskLevel'] as const) {
    const v = searchParams.get(p);
    if (v) (where as Record<string, unknown>)[p] = v;
  }

  try {
    const cases = await prisma.psyCase.findMany({
      where,
      orderBy: [{ riskLevel: 'desc' }, { updatedAt: 'desc' }],
      include: { _count: { select: { sessions: true } } },
    });
    return successResponse(cases);
  } catch (e) {
    console.error('GET psy/cases error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить кейсы', 500);
  }
}

/** POST /api/v1/psy/cases — создать кейс. owner = текущий психолог. */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { studentId, title, reason, riskLevel, riskJustification } = body as Record<string, string>;

  if (!studentId || !title?.trim()) {
    return errorResponse('VALIDATION_ERROR', 'Нужны ученик и название кейса');
  }
  const risk = (['green', 'yellow', 'red'].includes(riskLevel) ? riskLevel : 'green') as 'green' | 'yellow' | 'red';
  // Патч безопасности: красный риск требует текстового обоснования.
  if (risk === 'red' && !riskJustification?.trim()) {
    return errorResponse('VALIDATION_ERROR', 'Для красного риска обязательно текстовое обоснование');
  }

  try {
    const created = await prisma.psyCase.create({
      data: {
        studentId,
        ownerId: auth.session.user.id,
        title: title.trim(),
        reason: reason?.trim() || null,
        riskLevel: risk,
        riskJustification: risk === 'red' ? riskJustification!.trim() : null,
        status: 'new',
      },
    });
    // UC-5: красный риск → слепой safeguarding-алерт координаторам.
    if (risk === 'red') await emitSafeguardingAlert(created.id, riskJustification!.trim());
    // Ядро: импульс «психолог открыл кейс» в нейро-граф (live-событие).
    await emitEvent('psych.case.opened', { actorUserId: auth.session.user.id, studentId, payload: { caseId: created.id, risk } });
    return successResponse(created, 201);
  } catch (e) {
    console.error('POST psy/cases error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать кейс', 500);
  }
}
