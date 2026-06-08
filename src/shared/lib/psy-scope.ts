import { prisma } from '@/shared/lib/prisma';
import type { Role } from '@prisma/client';

/**
 * RLS для психологической службы (eSPSMS).
 *
 * Психолог видит ТОЛЬКО свои кейсы + кейсы, где он принятый со-терапевт
 * (collaborator со status=accepted). Старший психолог и супер-админ видят все
 * кейсы (конструктор/эскалация/техдоступ). Энфорсить ТОЛЬКО server-side —
 * никогда не доверять ownerId/caseId из тела запроса.
 */

// Роли с полным доступом ко всем кейсам.
const FULL_ACCESS: Role[] = ['senior_psychologist', 'super_admin'];

// Роли, которые могут вести кейсы (быть owner/collaborator).
export const CASE_OWNER_ROLES: Role[] = ['psychologist', 'senior_psychologist', 'specialist'];

// Роли, видящие кабинет психолога целиком.
export const PSY_CABINET_ROLES: Role[] = ['psychologist', 'senior_psychologist', 'specialist', 'super_admin'];

export interface PsyScope {
  userId: string;
  role: Role;
  full: boolean;
}

export function getPsyScope(userId: string, role: Role): PsyScope {
  return { userId, role, full: FULL_ACCESS.includes(role) };
}

/** Prisma where-фильтр для списка кейсов под RLS текущего пользователя. */
export async function caseWhereForScope(scope: PsyScope): Promise<Record<string, unknown>> {
  if (scope.full) return {};
  const collab = await prisma.psyCaseCollaborator.findMany({
    where: { userId: scope.userId, status: 'accepted' },
    select: { caseId: true },
  });
  return {
    OR: [
      { ownerId: scope.userId },
      { id: { in: collab.map((c) => c.caseId) } },
    ],
  };
}

/** Может ли пользователь видеть/редактировать конкретный кейс. */
export async function canAccessCase(scope: PsyScope, caseId: string): Promise<boolean> {
  if (scope.full) return true;
  const c = await prisma.psyCase.findUnique({ where: { id: caseId }, select: { ownerId: true } });
  if (!c) return false;
  if (c.ownerId === scope.userId) return true;
  const collab = await prisma.psyCaseCollaborator.findFirst({
    where: { caseId, userId: scope.userId, status: 'accepted' },
    select: { id: true },
  });
  return !!collab;
}
