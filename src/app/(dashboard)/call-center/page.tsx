'use client';

import { useEffect, useState, useCallback } from 'react';
import { Anchor, Badge, Button, Group, Loader, Modal, Paper, Stack, Table, Text, Textarea, Title } from '@mantine/core';
import { IconPhone, IconHeadset, IconClockHour4 } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

interface Debtor {
  studentId: string; name: string; className: string; phone: string | null;
  remaining: number; penalty: number; overdueDays: number;
  lastPromise: { text: string; at: string } | null;
}

function CallCenter() {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Debtor | null>(null);
  const [promiseText, setPromiseText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch('/api/v1/finance/debtors').then((r) => r.json()).catch(() => ({ data: [] }));
    setDebtors(j.data ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function savePromise() {
    if (!target || !promiseText.trim()) return;
    setSaving(true);
    await fetch(`/api/v1/students/${target.studentId}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'promise', text: promiseText }),
    });
    setSaving(false); setTarget(null); setPromiseText(''); load();
  }

  const fmt = (n: number) => `${n.toLocaleString('ru-RU')} сом`;

  return (
    <Stack gap="lg" p="md">
      <Group gap="xs"><IconHeadset size={26} color="#1971c2" /><Title order={2}>Колл-центр — задолжники</Title></Group>
      <Text c="dimmed" size="sm">Список просрочек. Звоните, фиксируйте обещания оплаты — они попадут в ленту ученика и прогноз прихода.</Text>

      <Paper withBorder p="md" radius="md">
        {loading ? <Group justify="center" p="xl"><Loader /></Group>
          : debtors.length === 0 ? <Text c="dimmed" ta="center" py="xl">Должников нет 🎉</Text>
          : (
            <Table highlightOnHover>
              <Table.Thead><Table.Tr>
                <Table.Th>Ученик</Table.Th><Table.Th>Класс</Table.Th><Table.Th>Телефон</Table.Th>
                <Table.Th>Долг</Table.Th><Table.Th>Пеня</Table.Th><Table.Th>Просрочка</Table.Th><Table.Th>Последнее обещание</Table.Th><Table.Th></Table.Th>
              </Table.Tr></Table.Thead>
              <Table.Tbody>
                {debtors.map((d) => (
                  <Table.Tr key={d.studentId}>
                    <Table.Td>{d.name}</Table.Td>
                    <Table.Td>{d.className}</Table.Td>
                    <Table.Td>{d.phone ? <Anchor href={`tel:${d.phone}`}><Group gap={4}><IconPhone size={13} />{d.phone}</Group></Anchor> : '—'}</Table.Td>
                    <Table.Td><Text fw={600}>{fmt(d.remaining)}</Text></Table.Td>
                    <Table.Td>{d.penalty > 0 ? <Text c="red">{fmt(d.penalty)}</Text> : '—'}</Table.Td>
                    <Table.Td><Badge color={d.overdueDays > 30 ? 'red' : 'orange'}>{d.overdueDays} дн</Badge></Table.Td>
                    <Table.Td>{d.lastPromise ? <Text size="xs" c="dimmed"><IconClockHour4 size={11} /> {d.lastPromise.text} ({fmtDate(d.lastPromise.at)})</Text> : '—'}</Table.Td>
                    <Table.Td><Button size="compact-xs" variant="light" onClick={() => setTarget(d)}>Обещание</Button></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
      </Paper>

      <Modal opened={!!target} onClose={() => setTarget(null)} title={`Обещание оплаты — ${target?.name}`} centered>
        <Stack gap="md">
          <Textarea label="Что обещал родитель" placeholder="Обещал оплатить завтра / перевёл на мбанк, скинет чек…" autosize minRows={2} value={promiseText} onChange={(e) => setPromiseText(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setTarget(null)}>Отмена</Button>
            <Button onClick={savePromise} loading={saving}>Сохранить</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function CallCenterPage() {
  return (
    <RoleGate roles={['call_center', 'super_admin', 'analyst', 'zavuch', 'accountant']}>
      <CallCenter />
    </RoleGate>
  );
}
