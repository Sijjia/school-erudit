import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const WRITE_ROLES = ['super_admin', 'analyst', 'zavuch', 'teacher', 'curator'] as const;

/** GET /api/v1/ai/presentations/[id] — полная презентация (только автор). */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;

    const item = await prisma.presentation.findUnique({ where: { id } });
    if (!item) return errorResponse('NOT_FOUND', 'Презентация не найдена', 404);
    if (item.authorId !== auth.session.user.id && auth.session.user.role !== 'super_admin') {
      return errorResponse('FORBIDDEN', 'Это не ваша презентация', 403);
    }
    return successResponse(item);
  } catch (error) {
    console.error('GET /api/v1/ai/presentations/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить презентацию', 500);
  }
}

/** DELETE /api/v1/ai/presentations/[id] — удалить (только автор). */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, { roles: [...WRITE_ROLES] });
    if (auth.response) return auth.response;
    const { id } = await ctx.params;

    const item = await prisma.presentation.findUnique({ where: { id }, select: { authorId: true } });
    if (!item) return errorResponse('NOT_FOUND', 'Презентация не найдена', 404);
    if (item.authorId !== auth.session.user.id && auth.session.user.role !== 'super_admin') {
      return errorResponse('FORBIDDEN', 'Это не ваша презентация', 403);
    }
    await prisma.presentation.delete({ where: { id } });
    return successResponse({ id });
  } catch (error) {
    console.error('DELETE /api/v1/ai/presentations/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось удалить презентацию', 500);
  }
}
