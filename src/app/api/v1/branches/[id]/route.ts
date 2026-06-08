import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/** PATCH /api/v1/branches/[id] — редактировать филиал (название/адрес/реквизиты для договоров). */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: ['super_admin', 'analyst'] });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
  if (typeof body.address === 'string') data.address = body.address;
  if (body.requisites && typeof body.requisites === 'object') data.requisites = body.requisites;
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
  if (Object.keys(data).length === 0) return errorResponse('VALIDATION_ERROR', 'Нет полей для обновления');
  try {
    const updated = await prisma.branch.update({ where: { id }, data });
    return successResponse(updated);
  } catch (e) {
    console.error('PATCH branches/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить филиал', 500);
  }
}
