import { cookies } from 'next/headers';
import { prisma } from '@/shared/lib/prisma';
import type { Role } from '@prisma/client';

/**
 * Скоупинг по филиалам (multi-branch). Энфорсить ТОЛЬКО server-side.
 * - super_admin/analyst видят все филиалы; текущий филиал берётся из cookie
 *   `bos_branch` (селектор в шапке); пусто = все.
 * - Остальные роли привязаны к своему домашнему `User.branchId`.
 */
const ALL_BRANCH_ROLES: Role[] = ['super_admin', 'analyst'];

export interface BranchScope {
  branchId: string | null; // null = без фильтра (все филиалы)
  canSeeAll: boolean;
}

export async function getBranchScope(userId: string, role: Role): Promise<BranchScope> {
  if (ALL_BRANCH_ROLES.includes(role)) {
    const selected = (await cookies()).get('bos_branch')?.value || null;
    return { branchId: selected, canSeeAll: true };
  }
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { branchId: true } });
  return { branchId: u?.branchId ?? null, canSeeAll: false };
}

/** Prisma-where фрагмент: {} (все) или { branchId }. */
export function branchWhere(scope: BranchScope): Record<string, unknown> {
  return scope.branchId ? { branchId: scope.branchId } : {};
}
