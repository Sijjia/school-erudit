import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';

/**
 * GET /api/v1/psy/cases/active?studentId=
 * UC-1: при создании кейса показать, что у ученика УЖЕ есть активный кейс у
 * коллеги (раскрываем только ФАКТ существования + владельца, без содержания).
 */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;

  const studentId = new URL(request.url).searchParams.get('studentId');
  if (!studentId) return errorResponse('VALIDATION_ERROR', 'Параметр studentId обязателен');

  try {
    const cases = await prisma.psyCase.findMany({
      where: { studentId, status: { not: 'closed' } },
      select: { id: true, ownerId: true, riskLevel: true, title: true },
    });
    const ownerIds = [...new Set(cases.map((c) => c.ownerId))];
    const owners = await prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, login: true, teacher: { select: { firstName: true, lastName: true } } },
    });
    const nameOf = (uid: string) => {
      const u = owners.find((o) => o.id === uid);
      if (!u) return '—';
      return u.teacher ? `${u.teacher.lastName} ${u.teacher.firstName}` : u.login;
    };
    const result = cases.map((c) => ({
      id: c.id,
      title: c.title,
      riskLevel: c.riskLevel,
      ownerId: c.ownerId,
      ownerName: nameOf(c.ownerId),
      isMine: c.ownerId === auth.session.user.id,
    }));
    return successResponse(result);
  } catch (e) {
    console.error('GET psy/cases/active error:', e);
    return errorResponse('INTERNAL_ERROR', 'Ошибка', 500);
  }
}
