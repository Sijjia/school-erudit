'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge, Button, Card, Group, Loader, Modal, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconUsersGroup, IconPlus, IconCheck, IconX } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface Cls { id: string; grade: number; letter: string; capacity?: number | null; studentCount?: number }
interface Entry { id: string; childName: string; parentPhone: string | null; position: number; note: string | null }

function Reserve() {
  const [classes, setClasses] = useState<Cls[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCls, setOpenCls] = useState<Cls | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch('/api/v1/classes').then((r) => r.json()).catch(() => ({ data: [] }));
    setClasses((j.data ?? []).sort((a: Cls, b: Cls) => a.grade - b.grade || a.letter.localeCompare(b.letter)));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Stack gap="lg" p="md">
      <Group gap="xs"><IconUsersGroup size={26} color="#1971c2" /><Title order={2}>Очередь / резерв в классы</Title></Group>
      <Text c="dimmed" size="sm">Лист ожидания по классам (на 1-й класс бывает ~100 в очереди). Запись → зачисление по мере мест.</Text>
      {loading ? <Group justify="center" p="xl"><Loader /></Group> : (
        <Stack gap="sm">
          {classes.map((c) => (
            <Card key={c.id} withBorder radius="md">
              <Group justify="space-between">
                <Group gap="xs">
                  <Text fw={600}>{c.grade}{c.letter}</Text>
                  <Badge variant="light">учеников: {c.studentCount ?? 0}{c.capacity ? ` / ${c.capacity}` : ''}</Badge>
                </Group>
                <Button size="xs" variant="light" onClick={() => setOpenCls(c)}>Очередь</Button>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      {openCls && <QueueModal cls={openCls} onClose={() => setOpenCls(null)} />}
    </Stack>
  );
}

function QueueModal({ cls, onClose }: { cls: Cls; onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch(`/api/v1/class-reserve?classId=${cls.id}`).then((r) => r.json()).catch(() => ({ data: [] }));
    setEntries(j.data ?? []); setLoading(false);
  }, [cls.id]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!name.trim()) return;
    await fetch('/api/v1/class-reserve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId: cls.id, childName: name, parentPhone: phone }) });
    setName(''); setPhone(''); load();
  }
  async function setStatus(id: string, status: string) {
    await fetch('/api/v1/class-reserve', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    load();
  }

  return (
    <Modal opened onClose={onClose} title={`Очередь в ${cls.grade}${cls.letter}`} centered size="lg">
      <Stack gap="md">
        <Group align="flex-end" gap="xs">
          <TextInput style={{ flex: 1 }} label="ФИО ребёнка" value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <TextInput label="Телефон" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
          <Button leftSection={<IconPlus size={16} />} onClick={add}>В очередь</Button>
        </Group>
        {loading ? <Group justify="center"><Loader size="sm" /></Group>
          : entries.length === 0 ? <Text c="dimmed">Очередь пуста.</Text>
          : (
            <Table>
              <Table.Thead><Table.Tr><Table.Th>#</Table.Th><Table.Th>Ребёнок</Table.Th><Table.Th>Телефон</Table.Th><Table.Th></Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {entries.map((e) => (
                  <Table.Tr key={e.id}>
                    <Table.Td>{e.position}</Table.Td>
                    <Table.Td>{e.childName}</Table.Td>
                    <Table.Td>{e.parentPhone ?? '—'}</Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        <Button size="compact-xs" variant="light" color="green" leftSection={<IconCheck size={12} />} onClick={() => setStatus(e.id, 'enrolled')}>Зачислить</Button>
                        <Button size="compact-xs" variant="subtle" color="red" leftSection={<IconX size={12} />} onClick={() => setStatus(e.id, 'cancelled')}>Снять</Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
      </Stack>
    </Modal>
  );
}

export default function ReservePage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary']}>
      <Reserve />
    </RoleGate>
  );
}
