import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { successResponse, errorResponse } from '@/shared/lib/api-response';
import { withAuth } from '@/shared/lib/api-auth';
import { createItem } from '@/shared/lib/agent/engine';

/**
 * POST /api/v1/agent/items/[id]/approve  { message? }
 * Согласование исходящего письма (kind=draft): адресат подтверждает (с правками) →
 * письмо уходит родителю(ям) в инбокс + внешний канал (Telegram). Черновик закрывается.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request);
    if (auth.response) return auth.response;
    const userId = auth.session.user.id;
    const role = auth.session.user.role;
    const { id } = await ctx.params;

    const item = await prisma.agentItem.findUnique({ where: { id } });
    if (!item) return errorResponse('NOT_FOUND', 'Элемент не найден', 404);
    const isAddressee = item.forUserId === userId || (item.forRole && item.forRole === role);
    if (!isAddressee) return errorResponse('FORBIDDEN', 'Это не ваш элемент', 403);
    if (item.kind !== 'draft') return errorResponse('VALIDATION_ERROR', 'Согласовать можно только черновик');
    if (item.status === 'done') return errorResponse('VALIDATION_ERROR', 'Уже отправлено');

    const body = await request.json().catch(() => ({}));
    const payload = (item.payload ?? {}) as { proposedMessage?: string; parentUserIds?: string[] };
    const message = (typeof body.message === 'string' && body.message.trim())
      ? body.message.trim().slice(0, 2000)
      : (payload.proposedMessage ?? item.body);
    const recipients = Array.isArray(payload.parentUserIds) ? payload.parentUserIds : [];

    for (const uid of recipients) {
      await createItem({
        ruleKey: item.ruleKey, eventId: item.eventId, forUserId: uid, studentId: item.studentId,
        kind: 'alert', severity: 'warn', title: 'Сообщение от учителя', body: message,
        payload: { fromDraft: item.id },
      });
    }

    await prisma.agentItem.update({
      where: { id }, data: { status: 'done', resolvedAt: new Date(), resolvedBy: userId },
    });
    await prisma.agentActionLog.create({ data: { itemId: id, action: 'approved', byUserId: userId, detail: { sent: recipients.length } } });

    return successResponse({ sent: recipients.length });
  } catch (error) {
    console.error('POST /api/v1/agent/items/[id]/approve error:', error);
    return errorResponse('INTERNAL_ERROR', 'Не удалось согласовать письмо', 500);
  }
}
