export interface PrintableContract {
  number: string;
  year?: string | null;
  baseAmount: number;
  discountPct: number;
  discountNote?: string | null;
  amount: number;
  prepaymentPct: number;
  scheduleType: string;
  scheduleMonths: number;
  paymentDay: number;
  startDate?: string | null;
  representative?: { fio?: string; inn?: string; phone?: string } | null;
  requisites?: { name?: string; inn?: string; account?: string; address?: string } | null;
}

const fmtSom = (n: number) => `${n.toLocaleString('ru-RU')} сом`;
const fmtD = (v?: string | null) => (v ? new Date(v).toLocaleDateString('ru-RU') : '«__» ____________ 20__ г.');
const SCHED: Record<string, string> = { monthly: 'помесячно', quarterly: 'по триместрам', yearly: 'единовременно за год' };

/** Печатная форма школьного договора → отдельное окно → window.print(). */
export function printContract(c: PrintableContract, studentName: string, className?: string) {
  const r = c.requisites ?? {};
  const rep = c.representative ?? {};
  const perInstallment = c.scheduleMonths > 0 ? Math.round(c.amount / c.scheduleMonths) : c.amount;
  const prepay = Math.round((c.amount * c.prepaymentPct) / 100);

  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>Договор №${c.number}</title>
<style>
  body { font-family: 'Times New Roman', serif; color: #111; margin: 40px; line-height: 1.5; }
  .head { text-align: center; border-bottom: 2px solid #111; padding-bottom: 10px; }
  .head .org { font-size: 18px; font-weight: 700; }
  h1 { font-size: 17px; text-align: center; margin: 20px 0 6px; }
  .muted { color: #555; font-size: 13px; }
  .row { display: flex; justify-content: space-between; font-size: 13px; margin-top: 6px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  td, th { padding: 8px 10px; border: 1px solid #999; font-size: 14px; text-align: left; }
  th { background: #f2f2f2; width: 42%; }
  .total td { font-weight: 700; background: #f7f7f7; }
  p { font-size: 14px; text-align: justify; }
  .sign { margin-top: 48px; display: flex; justify-content: space-between; font-size: 13px; }
  .sign div { border-top: 1px solid #111; padding-top: 4px; width: 240px; text-align: center; }
  @media print { body { margin: 16mm; } }
</style></head><body>
  <div class="head">
    <div class="org">${r.name ?? 'Частная школа'}</div>
    <div class="muted">${r.address ?? ''} ${r.inn ? '· ИНН ' + r.inn : ''}</div>
  </div>
  <h1>ДОГОВОР № ${c.number}</h1>
  <div class="muted" style="text-align:center">об оказании образовательных услуг · ${c.year ?? ''}</div>
  <div class="row"><span>г. Бишкек</span><span>${fmtD(c.startDate)}</span></div>

  <p><b>1. Предмет договора.</b> Школа обязуется оказать обучающемуся <b>${studentName}</b>${className ? ` (класс ${className})` : ''} образовательные услуги в ${c.year ?? 'текущем'} учебном году, а Представитель — оплатить их в порядке, установленном настоящим договором.</p>

  <table>
    <tr><th>Представитель</th><td>${rep.fio ?? '—'}${rep.inn ? ' · ИНН ' + rep.inn : ''}${rep.phone ? ' · ' + rep.phone : ''}</td></tr>
    <tr><th>Стоимость обучения</th><td>${fmtSom(c.baseAmount)}</td></tr>
    ${c.discountPct > 0 ? `<tr><th>Скидка ${c.discountPct}%${c.discountNote ? ' (' + c.discountNote + ')' : ''}</th><td>−${fmtSom(c.baseAmount - c.amount)}</td></tr>` : ''}
    <tr class="total"><td>Итого к оплате</td><td>${fmtSom(c.amount)}</td></tr>
    <tr><th>Предоплата ${c.prepaymentPct}%</th><td>${fmtSom(prepay)}</td></tr>
    <tr><th>График оплаты</th><td>${SCHED[c.scheduleType] ?? c.scheduleType} (${c.scheduleMonths} платеж(ей) по ~${fmtSom(perInstallment)}), до ${c.paymentDay} числа</td></tr>
  </table>

  <p><b>2. Реквизиты школы.</b> ${r.name ?? ''}${r.inn ? ', ИНН ' + r.inn : ''}${r.account ? ', р/с ' + r.account : ''}.</p>
  <p><b>3. Прочие условия.</b> Договор вступает в силу с момента подписания и действует до конца учебного года. Изменения оформляются дополнительным соглашением.</p>

  <div class="sign">
    <div>Школа</div>
    <div>Представитель</div>
  </div>
  <script>window.onload = () => window.print();</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=860,height=940');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
