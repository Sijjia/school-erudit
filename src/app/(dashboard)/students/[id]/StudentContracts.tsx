'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge, Button, Card, Checkbox, Group, Loader, Modal, NumberInput, Paper, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconFileText, IconPlus, IconPrinter } from '@tabler/icons-react';
import { fmtDate } from '@/shared/components/ui/resource-helpers';
import { useRole } from '@/shared/hooks/useRole';
import { printContract } from '@/shared/lib/contract/print-contract';

interface Contract {
  id: string; number: string; year: string; baseAmount: number; discountPct: number; discountNote: string | null;
  amount: number; prepaymentPct: number; scheduleType: string; scheduleMonths: number; paymentDay: number;
  status: string; startDate: string | null; representative: Record<string, string> | null; requisites: Record<string, string> | null; createdAt: string;
}
const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: 'gray' }, active: { label: 'Действует', color: 'green' },
  completed: { label: 'Завершён', color: 'blue' }, cancelled: { label: 'Расторгнут', color: 'red' },
};

export function StudentContracts({ studentId, studentName, className }: { studentId: string; studentName: string; className?: string }) {
  const { has } = useRole();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch(`/api/v1/contracts?studentId=${studentId}`).then((r) => r.json()).catch(() => ({ data: [] }));
    setContracts(j.data ?? []);
    setLoading(false);
  }, [studentId]);
  useEffect(() => { load(); }, [load]);

  const canCreate = has('super_admin', 'analyst', 'zavuch', 'secretary');

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={5}>Договоры</Title>
        {canCreate && <Button leftSection={<IconPlus size={16} />} onClick={() => setOpen(true)}>Новый договор</Button>}
      </Group>

      {loading ? <Group justify="center" p="xl"><Loader /></Group>
        : contracts.length === 0 ? <Text c="dimmed">Договоров пока нет.</Text>
        : (
          <Stack gap="sm">
            {contracts.map((c) => (
              <Card key={c.id} withBorder radius="md">
                <Group justify="space-between">
                  <div>
                    <Group gap="xs">
                      <Text fw={600}>№ {c.number}</Text>
                      <Badge color={STATUS[c.status]?.color}>{STATUS[c.status]?.label ?? c.status}</Badge>
                      <Text size="sm" c="dimmed">{c.year}</Text>
                    </Group>
                    <Text size="sm" c="dimmed" mt={4}>
                      {c.amount.toLocaleString('ru-RU')} сом{c.discountPct > 0 ? ` (скидка ${c.discountPct}%)` : ''} · {c.scheduleMonths} платеж. · до {c.paymentDay} числа
                    </Text>
                  </div>
                  <Button size="xs" variant="light" leftSection={<IconPrinter size={14} />}
                    onClick={() => printContract(c, studentName, className)}>Печать (PDF)</Button>
                </Group>
              </Card>
            ))}
          </Stack>
        )}

      {open && <ContractModal studentId={studentId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </Stack>
  );
}

function ContractModal({ studentId, onClose, onDone }: { studentId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    number: '', year: '2026–2027', baseAmount: 650000, discountPct: 0, discountNote: '', prepaymentPct: 20,
    scheduleType: 'monthly', scheduleMonths: 9, paymentDay: 10, repFio: '', repInn: '', repPhone: '', startDate: '', gen: true,
  });
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    if (!f.number.trim()) { setErr('Укажите номер договора'); return; }
    setSaving(true); setErr('');
    const res = await fetch('/api/v1/contracts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId, number: f.number, year: f.year, baseAmount: f.baseAmount, discountPct: f.discountPct,
        discountNote: f.discountNote, prepaymentPct: f.prepaymentPct, scheduleType: f.scheduleType,
        scheduleMonths: f.scheduleMonths, paymentDay: f.paymentDay, startDate: f.startDate || null,
        representative: { fio: f.repFio, inn: f.repInn, phone: f.repPhone }, generateInvoices: f.gen,
      }),
    });
    const j = await res.json(); setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    onDone();
  }

  return (
    <Modal opened onClose={onClose} title="Новый договор" centered size="lg">
      <Stack gap="sm">
        <Group grow>
          <TextInput label="Номер договора" required value={f.number} onChange={(e) => set('number', e.currentTarget.value)} />
          <TextInput label="Учебный год" value={f.year} onChange={(e) => set('year', e.currentTarget.value)} />
        </Group>
        <Group grow>
          <NumberInput label="Стоимость (сом)" value={f.baseAmount} onChange={(v) => set('baseAmount', Number(v) || 0)} thousandSeparator=" " />
          <NumberInput label="Скидка %" value={f.discountPct} onChange={(v) => set('discountPct', Number(v) || 0)} min={0} max={100} />
          <NumberInput label="Предоплата %" value={f.prepaymentPct} onChange={(v) => set('prepaymentPct', Number(v) || 0)} min={0} max={100} />
        </Group>
        <TextInput label="За что скидка (примечание)" value={f.discountNote} onChange={(e) => set('discountNote', e.currentTarget.value)} />
        <Group grow>
          <Select label="График" value={f.scheduleType} onChange={(v) => set('scheduleType', v ?? 'monthly')}
            data={[{ value: 'monthly', label: 'Помесячно' }, { value: 'quarterly', label: 'По триместрам' }, { value: 'yearly', label: 'За год' }]} />
          <NumberInput label="Платежей" value={f.scheduleMonths} onChange={(v) => set('scheduleMonths', Number(v) || 1)} min={1} max={12} />
          <NumberInput label="День оплаты" value={f.paymentDay} onChange={(v) => set('paymentDay', Number(v) || 10)} min={1} max={28} />
        </Group>
        <Text size="sm" fw={500}>Представитель</Text>
        <Group grow>
          <TextInput label="ФИО" value={f.repFio} onChange={(e) => set('repFio', e.currentTarget.value)} />
          <TextInput label="ИНН" value={f.repInn} onChange={(e) => set('repInn', e.currentTarget.value)} />
          <TextInput label="Телефон" value={f.repPhone} onChange={(e) => set('repPhone', e.currentTarget.value)} />
        </Group>
        <Checkbox label="Сгенерировать счета по графику" checked={f.gen} onChange={(e) => set('gen', e.currentTarget.checked)} />
        {err && <Text c="red" size="sm">{err}</Text>}
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button>
          <Button onClick={submit} loading={saving}>Создать договор</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
