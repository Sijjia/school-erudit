/**
 * SMS-канал (фолбэк для родителей без Telegram/WhatsApp). Gated на SMS_API_URL +
 * SMS_API_KEY — без них безопасный no-op. Конкретный провайдер/формат — позже.
 */
export function isSmsConfigured(): boolean {
  return Boolean(process.env.SMS_API_URL && process.env.SMS_API_KEY);
}

export async function sendSms(phone: string, text: string): Promise<boolean> {
  if (!isSmsConfigured() || !phone) return false;
  try {
    const res = await fetch(process.env.SMS_API_URL!, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.SMS_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone.replace(/\s/g, ''), text }),
    });
    if (!res.ok) { console.error('[sms] failed:', res.status); return false; }
    return true;
  } catch (e) {
    console.error('[sms] error:', e);
    return false;
  }
}
