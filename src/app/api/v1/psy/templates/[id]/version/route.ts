import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';

const MANAGE_ROLES = ['senior_psychologist', 'super_admin'] as const;

/**
 * POST /api/v1/psy/templates/[id]/version — сохранить как новую версию.
 * Патч аналитического коллапса (UC-4): если изменилась шкала метрики, mappingRule
 * обязателен, иначе старые графики динамики «сломаются» при склейке версий.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await withAuth(request, { roles: [...MANAGE_ROLES] });
  if (auth.response) return auth.response;
  const { id } = await ctx.params;

  const source = await prisma.psyDiagnosticTemplate.findUnique({ where: { id } });
  if (!source) return errorResponse('NOT_FOUND', 'Методика не найдена', 404);

  const body = await request.json().catch(() => ({}));
  const { schema, mappingRule } = body as { schema?: Record<string, unknown>; mappingRule?: Record<string, unknown> };
  const newSchema = { ...(source.schema as Record<string, unknown>), ...(schema ?? {}) };

  const oldScale = (source.schema as { scaleMax?: number })?.scaleMax;
  const newScale = (newSchema as { scaleMax?: number })?.scaleMax;
  const metricChanged = oldScale !== undefined && newScale !== undefined && Number(oldScale) !== Number(newScale);

  if (metricChanged && (!mappingRule || !mappingRule.op)) {
    return errorResponse(
      'MAPPING_REQUIRED',
      `Изменилась метрика (шкала ${oldScale} → ${newScale}). Задайте правило пересчёта (Mapping Rule) для старых графиков.`,
      409,
    );
  }

  const rootId = source.parentTemplateId ?? source.id;
  const lineage = await prisma.psyDiagnosticTemplate.findMany({
    where: { OR: [{ id: rootId }, { parentTemplateId: rootId }] },
    select: { version: true },
  });
  const nextVersion = Math.max(...lineage.map((t) => t.version), source.version) + 1;

  try {
    const created = await prisma.$transaction(async (tx) => {
      // старую версию выводим из активного выбора (данные сохраняются для истории/графиков)
      await tx.psyDiagnosticTemplate.update({ where: { id: source.id }, data: { isActive: false } });
      return tx.psyDiagnosticTemplate.create({
        data: {
          name: source.name,
          version: nextVersion,
          parentTemplateId: rootId,
          authorId: auth.session.user.id,
          schema: newSchema as unknown as Prisma.InputJsonValue,
          mappingRule: metricChanged ? (mappingRule as unknown as Prisma.InputJsonValue) : undefined,
          isActive: true,
        },
      });
    });
    return successResponse(created, 201);
  } catch (e) {
    console.error('POST psy/templates/version error:', e);
    return errorResponse('INTERNAL_ERROR', 'Не удалось сохранить версию', 500);
  }
}
