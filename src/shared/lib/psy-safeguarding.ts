import { prisma } from '@/shared/lib/prisma';
import { notifyUser } from '@/shared/lib/agent/notify';
import { emitEvent } from '@/shared/lib/agent/engine';

/**
 * Safeguarding (UC-5): при критическом (красном) риске создаём алерт и шлём
 * координаторам СЛЕПОЕ уведомление — строго стандартный текст без имён и номеров
 * кейса. Детали доступны только после входа в закрытый контур (/safeguarding).
 */
export const COORDINATOR_ROLES = ['safeguarding_lead', 'zavuch', 'super_admin'] as const;

const BLIND_TITLE = '🔒 Новое системное уведомление eSPSMS';
const BLIND_BODY = 'Требуется авторизация в системе.';

export async function emitSafeguardingAlert(caseId: string, reason: string): Promise<void> {
  try {
    // не плодим дубли открытых алертов на один кейс
    const existing = await prisma.psyAlert.findFirst({ where: { caseId, status: { not: 'resolved' } } });
    if (!existing) {
      await prisma.psyAlert.create({ data: { caseId, reason, status: 'open' } });
    }
    const coords = await prisma.user.findMany({
      where: { role: { in: [...COORDINATOR_ROLES] }, isActive: true },
      select: { id: true },
    });
    await Promise.all(coords.map((u) => notifyUser(u.id, BLIND_TITLE, BLIND_BODY)));
    // Ядро: слепой импульс в нейро-граф (без ФИО — приватность ТЗ).
    await emitEvent('safeguard.alert', { payload: { caseId } });
  } catch (e) {
    console.error('emitSafeguardingAlert failed:', e);
  }
}
