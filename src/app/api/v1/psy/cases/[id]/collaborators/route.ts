import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { CASE_OWNER_ROLES } from '@/shared/lib/psy-scope';

/** POST — запросить со-терапевтический доступ к кейсу (UC-1, консилиум). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const c = await prisma.psyCase.findUnique({ where: { id }, select: { ownerId: true } });
  if (!c) return errorResponse('NOT_FOUND', 'Кейс не найден', 404);
  if (c.ownerId === auth.session.user.id) return errorResponse('VALIDATION_ERROR', 'Вы уже владелец кейса');

  try {
    const collab = await prisma.psyCaseCollaborator.upsert({
      where: { caseId_userId: { caseId: id, userId: auth.session.user.id } },
      update: { status: 'pending', requestedAt: new Date(), decidedAt: null },
      create: { caseId: id, userId: auth.session.user.id, status: 'pending' },
    });
    return successResponse(collab, 201);
  } catch (e) {
    console.error('POST collaborators error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось отправить запрос', 500);
  }
}

/** PATCH — владелец принимает/отклоняет запрос со-терапевта. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: CASE_OWNER_ROLES });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const c = await prisma.psyCase.findUnique({ where: { id }, select: { ownerId: true } });
  if (!c) return errorResponse('NOT_FOUND', 'Кейс не найден', 404);
  if (c.ownerId !== auth.session.user.id) return errorResponse('FORBIDDEN', 'Только владелец кейса решает', 403);

  const body = await request.json().catch(() => ({}));
  const { userId, status } = body as Record<string, string>;
  if (!userId || !['accepted', 'declined'].includes(status)) {
    return errorResponse('VALIDATION_ERROR', 'Нужны userId и status (accepted|declined)');
  }

  try {
    const updated = await prisma.psyCaseCollaborator.update({
      where: { caseId_userId: { caseId: id, userId } },
      data: { status: status as 'accepted', decidedAt: new Date() },
    });
    return successResponse(updated);
  } catch (e) {
    console.error('PATCH collaborators error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить', 500);
  }
}
