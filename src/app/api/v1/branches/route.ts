import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

/** GET /api/v1/branches — список филиалов (всем авторизованным, для селектора). */
export async function GET(request: NextRequest) {
  const auth = await withAuth(request);
  if (auth.response) return auth.response;
  try {
    const branches = await prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    return successResponse(branches);
  } catch (e) {
    console.error('GET branches error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось загрузить филиалы', 500);
  }
}

/** POST /api/v1/branches — создать филиал (только админ). */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { roles: ['super_admin', 'analyst'] });
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const { name, address, requisites } = body as Record<string, unknown>;
  if (!name || !String(name).trim()) return errorResponse('VALIDATION_ERROR', 'Нужно название филиала');
  try {
    const created = await prisma.branch.create({
      data: { name: String(name).trim(), address: address ? String(address) : null, requisites: (requisites as object) ?? undefined },
    });
    return successResponse(created, 201);
  } catch (e) {
    console.error('POST branches error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось создать филиал', 500);
  }
}
