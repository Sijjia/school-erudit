import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/** GET /api/v1/incidents-summary?classId= — счётчики заметок по ученикам класса (для журнала). */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request, { roles: ['teacher', 'curator', 'zavuch', 'super_admin', 'analyst', 'secretary', 'specialist', 'psychologist'] });
    if (auth.response) return auth.response;

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    if (!classId) return errorResponse('VALIDATION_ERROR', 'classId обязателен');

    const grouped = await prisma.behaviorIncident.groupBy({
      by: ['studentId'],
      where: { student: { classId } },
      _count: true,
    });
    return successResponse(Object.fromEntries(grouped.map((g) => [g.studentId, g._count])));
  } catch (error) {
    console.error('GET /api/v1/incidents-summary error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить заметки', 500);
  }
}
