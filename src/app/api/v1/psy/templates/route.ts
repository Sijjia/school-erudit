import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { PSY_CABINET_ROLES } from '@/shared/lib/psy-scope';

const MANAGE_ROLES = ['senior_psychologist', 'super_admin'] as const;

/** GET /api/v1/psy/templates — список методик (психологи выбирают, старший управляет). */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: PSY_CABINET_ROLES });
  if (auth.response) return auth.response;
  try {
    const templates = await prisma.psyDiagnosticTemplate.findMany({ orderBy: [{ name: 'asc' }, { version: 'desc' }] });
    return successResponse(templates);
  } catch (e) {
    console.error('GET psy/templates error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить методики', 500);
  }
}

/** DELETE /api/v1/psy/templates?id= — удалить методику (только старший психолог). */
export async function DELETE(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...MANAGE_ROLES] });
  if (auth.response) return auth.response;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return errorResponse('VALIDATION_ERROR', 'Параметр id обязателен');
  try {
    await prisma.psyDiagnosticTemplate.delete({ where: { id } });
    return successResponse({ id });
  } catch (e) {
    console.error('DELETE psy/templates error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить', 500);
  }
}

/** POST /api/v1/psy/templates — создать методику v1 (только старший психолог). */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: [...MANAGE_ROLES] });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const { name, metric, scaleMin, scaleMax, questions } = body as Record<string, unknown>;
  if (!name || !String(name).trim()) return errorResponse('VALIDATION_ERROR', 'Нужно название методики');

  try {
    const created = await prisma.psyDiagnosticTemplate.create({
      data: {
        name: String(name).trim(),
        version: 1,
        authorId: auth.session.user.id,
        schema: {
          metric: metric ? String(metric) : 'балл',
          scaleMin: Number(scaleMin ?? 1),
          scaleMax: Number(scaleMax ?? 10),
          questions: Array.isArray(questions) ? questions : [],
        },
        isActive: true,
      },
    });
    return successResponse(created, 201);
  } catch (e) {
    console.error('POST psy/templates error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать методику', 500);
  }
}
