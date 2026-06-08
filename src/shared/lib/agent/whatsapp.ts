/**
 * WhatsApp Business Cloud API — канал доставки уведомлений (напоминания об оплате
 * для родителей по телефону). Gated на WHATSAPP_TOKEN + WHATSAPP_PHONE_ID — без
 * них безопасный no-op. Провайдер/шаблоны настраиваются позже.
 */
export function isWhatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

export async function sendWhatsapp(phone: string, text: string): Promise<boolean> {
  if (!isWhatsappConfigured() || !phone) return false;
  const to = phone.replace(/\D/g, '');
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
    });
    if (!res.ok) { console.error('[whatsapp] failed:', res.status); return false; }
    return true;
  } catch (e) {
    console.error('[whatsapp] error:', e);
    return false;
  }
}
