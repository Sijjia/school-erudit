import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/**
 * GET /api/v1/agent/items — элементы Панели агента для текущего пользователя
 * (адресованные ему лично ИЛИ его роли). ?status=all — показать и закрытые.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.session.user.id;
    const role = auth.session.user.role;

    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get('status') === 'all';
    const statusFilter = showAll ? {} : { status: { in: ['new', 'in_progress', 'approved'] } };

    const items = await prisma.agentItem.findMany({
      where: { OR: [{ forUserId: userId }, { forRole: role }], ...statusFilter },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    });
    const newCount = await prisma.agentItem.count({
      where: { OR: [{ forUserId: userId }, { forRole: role }], status: 'new' },
    });
    return successResponse({ items, newCount });
  } catch (error) {
    console.error('GET /api/v1/agent/items error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить панель агента', 500);
  }
}
