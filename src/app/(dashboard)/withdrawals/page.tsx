'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, Group, Loader, Modal, Paper, Select, Stack, Table, Text, Textarea, Title } from '@mantine/core';
import { IconUserMinus, IconPlus } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

interface W { id: string; studentName: string; reason: string; date: string }
interface Student { id: string; firstName: string; lastName: string }

function Withdrawals() {
  const [list, setList] = useState<W[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [sid, setSid] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [w, s] = await Promise.all([
      fetch('/api/v1/withdrawals').then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/v1/students').then((r) => r.json()).catch(() => ({ data: [] })),
    ]);
    setList(w.data ?? []); setStudents(s.data ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!sid || !reason.trim()) { setErr('Выберите ученика и укажите причину'); return; }
    setSaving(true); setErr('');
    const res = await fetch('/api/v1/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: sid, reason }) });
    const j = await res.json(); setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    setOpen(false); setSid(null); setReason(''); load();
  }

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Group gap="xs"><IconUserMinus size={26} color="#e03131" /><Title order={2}>Отчисления</Title></Group>
        <Button color="red" variant="light" leftSection={<IconPlus size={16} />} onClick={() => setOpen(true)}>Отчислить ученика</Button>
      </Group>
      <Text c="dimmed" size="sm">Отчисление переводит ученика в статус «отчислен», отменяет неоплаченные счета и активный договор.</Text>

      <Paper withBorder p="md" radius="md">
        {loading ? <Group justify="center" p="xl"><Loader /></Group>
          : list.length === 0 ? <Text c="dimmed" ta="center" py="xl">Отчислений нет.</Text>
          : (
            <Table>
              <Table.Thead><Table.Tr><Table.Th>Ученик</Table.Th><Table.Th>Причина</Table.Th><Table.Th>Дата</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {list.map((w) => (
                  <Table.Tr key={w.id}><Table.Td>{w.studentName}</Table.Td><Table.Td>{w.reason}</Table.Td><Table.Td>{fmtDate(w.date)}</Table.Td></Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
      </Paper>

      <Modal opened={open} onClose={() => setOpen(false)} title="Отчисление ученика" centered>
        <Stack gap="md">
          <Select label="Ученик" placeholder="Найти" searchable required value={sid} onChange={setSid}
            data={students.map((s) => ({ value: s.id, label: `${s.lastName} ${s.firstName}` }))} />
          <Textarea label="Причина" required autosize minRows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          {err && <Text c="red" size="sm">{err}</Text>}
          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setOpen(false)}>Отмена</Button>
            <Button color="red" onClick={submit} loading={saving}>Отчислить</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

export default function WithdrawalsPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary']}>
      <Withdrawals />
    </RoleGate>
  );
}
