import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { getPsyScope, canAccessCase, CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';
import { deidentifyForCase, reidentify } from '@/shared/lib/ai/psy/deidentify';
import { structureDap } from '@/shared/lib/ai/psy/dap';

/**
 * POST /api/v1/psy/sessions/dap  { caseId, rawNote }
 * Структурирует сырую заметку в DAP. ПРИВАТНОСТЬ: текст обезличивается на сервере
 * (ФИО → маркеры) ДО облачного LLM; ответ ре-идентифицируется здесь же.
 * Ничего не сохраняет — отдаёт черновик, который психолог проверяет и правит.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;

  const { caseId, rawNote } = (await request.json().catch(() => ({}))) as { caseId?: string; rawNote?: string };
  if (!caseId || !rawNote?.trim()) return errorResponse('VALIDATION_ERROR', 'Нужны caseId и текст заметки');

  const scope = getPsyScope(auth.session.user.id, auth.session.user.role);
  if (!(await canAccessCase(scope, caseId))) return errorResponse('FORBIDDEN', 'Нет доступа к этому кейсу', 403);

  try {
    // 1) обезличиваем (ФИО → маркеры) — карта остаётся ТОЛЬКО на сервере
    const deid = await deidentifyForCase(caseId, rawNote);
    // 2) структурируем обезличенный текст (облачный LLM или локальный fallback)
    const { dap, source } = await structureDap(deid.masked);
    // 3) ре-идентификация ответа для показа психологу
    const result = {
      data: reidentify(dap.data, deid.map),
      assessment: reidentify(dap.assessment, deid.map),
      plan: reidentify(dap.plan, deid.map),
    };
    return successResponse({
      dap: result,
      source, // 'llm' | 'stub'
      privacy: { maskedEntities: deid.count, sentToCloud: deid.masked }, // прозрачность: что реально ушло
    });
  } catch (e) {
    console.error('POST psy/sessions/dap error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось структурировать DAP', 500);
  }
}
