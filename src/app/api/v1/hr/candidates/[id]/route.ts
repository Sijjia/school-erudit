import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const ROLES = ['super_admin', 'analyst', 'zavuch', 'hr'] as const;
const STATUSES = ['reserve', 'interview', 'offer', 'hired', 'rejected'];

/** PATCH — двигать кандидата по воронке (резерв→собеседование→оффер→принят). */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: [...ROLES] });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.status === 'string' && STATUSES.includes(body.status)) data.status = body.status;
  if (typeof body.note === 'string') data.note = body.note;
  if (Object.keys(data).length === 0) return errorResponse('VALIDATION_ERROR', 'Нет полей для обновления');
  try {
    const updated = await prisma.candidate.update({ where: { id }, data });
    return successResponse(updated);
  } catch (e) {
    console.error('PATCH hr/candidates/[id] error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось обновить', 500);
  }
}
