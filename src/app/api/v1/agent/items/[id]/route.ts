import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const ALLOWED = ['in_progress', 'done', 'dismissed', 'approved'] as const;

/**
 * PATCH /api/v1/agent/items/[id] { status } — реакция человека на элемент.
 * Менять может только адресат (лично или по роли). Пишется в аудит.
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.session.user.id;
    const role = auth.session.user.role;
    const { id } = await ctx.params;

    const body = await request.json();
    const status = String(body.status ?? '');
    if (!ALLOWED.includes(status as (typeof ALLOWED)[number])) {
      return errorResponse('VALIDATION_ERROR', `status должен быть одним из: ${ALLOWED.join(', ')}`);
    }

    const item = await prisma.agentItem.findUnique({ where: { id } });
    if (!item) return errorResponse('NOT_FOUND', 'Элемент не найден', 404);
    const isAddressee = item.forUserId === userId || (item.forRole && item.forRole === role);
    if (!isAddressee) return errorResponse('FORBIDDEN', 'Это не ваш элемент панели', 403);

    const closed = status === 'done' || status === 'dismissed';
    const updated = await prisma.agentItem.update({
      where: { id },
      data: { status, resolvedAt: closed ? new Date() : null, resolvedBy: closed ? userId : null },
    });
    await prisma.agentActionLog.create({ data: { itemId: id, action: status, byUserId: userId } });
    return successResponse(updated);
  } catch (error) {
    console.error('PATCH /api/v1/agent/items/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить элемент', 500);
  }
}
