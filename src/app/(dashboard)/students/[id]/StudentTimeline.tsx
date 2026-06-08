'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge, Button, Group, Loader, Paper, Select, Stack, Text, Textarea, Timeline, Title } from '@mantine/core';
import { IconCash, IconAlertTriangle, IconBrain, IconNote, IconPhone, IconClockHour4, IconSchool } from '@tabler/icons-react';
import { fmtDate } from '@/shared/components/ui/resource-helpers';
import { useRole } from '@/shared/hooks/useRole';

interface TItem { date: string; type: string; title: string; detail?: string; source: string }

const ICON: Record<string, React.ReactNode> = {
  finance: <IconCash size={14} />, overdue: <IconAlertTriangle size={14} />, promise: <IconPhone size={14} />,
  call: <IconPhone size={14} />, behavior: <IconAlertTriangle size={14} />, psych: <IconBrain size={14} />,
  status: <IconSchool size={14} />, note: <IconNote size={14} />,
};
const COLOR: Record<string, string> = {
  finance: 'green', overdue: 'red', promise: 'orange', call: 'blue', behavior: 'yellow', psych: 'grape', status: 'teal', note: 'gray',
};

export function StudentTimeline({ studentId }: { studentId: string }) {
  const { has } = useRole();
  const [items, setItems] = useState<TItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteType, setNoteType] = useState('note');
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch(`/api/v1/students/${studentId}/timeline`).then((r) => r.json()).catch(() => ({ data: [] }));
    setItems(j.data ?? []);
    setLoading(false);
  }, [studentId]);
  useEffect(() => { load(); }, [load]);

  async function addNote() {
    if (!noteText.trim()) return;
    setSaving(true);
    await fetch(`/api/v1/students/${studentId}/notes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: noteType, text: noteText }),
    });
    setSaving(false); setNoteText('');
    load();
  }

  const canAddNote = has('super_admin', 'analyst', 'zavuch', 'secretary', 'teacher', 'curator', 'accountant', 'call_center', 'hr', 'doctor');

  return (
    <Stack gap="md">
      <Title order={5}>Лента событий ученика</Title>
      <Text size="sm" c="dimmed">Единая хронология по всем ролям. Содержание психологических сессий конфиденциально и не раскрывается.</Text>

      {canAddNote && (
        <Paper withBorder p="sm" radius="md">
          <Group align="flex-end" gap="xs">
            <Select w={170} label="Тип" value={noteType} onChange={(v) => setNoteType(v ?? 'note')}
              data={[{ value: 'note', label: 'Заметка' }, { value: 'promise', label: 'Обещание оплаты' }, { value: 'call', label: 'Звонок' }, { value: 'status', label: 'Статус' }]} />
            <Textarea style={{ flex: 1 }} label="Текст" autosize minRows={1} value={noteText} onChange={(e) => setNoteText(e.currentTarget.value)} />
            <Button onClick={addNote} loading={saving}>Добавить</Button>
          </Group>
        </Paper>
      )}

      {loading ? <Group justify="center" p="xl"><Loader /></Group>
        : items.length === 0 ? <Text c="dimmed">Событий пока нет.</Text>
        : (
          <Timeline active={-1} bulletSize={24} lineWidth={2}>
            {items.map((it, i) => (
              <Timeline.Item key={i} bullet={ICON[it.type] ?? <IconClockHour4 size={14} />} color={COLOR[it.type] ?? 'gray'}
                title={<Group gap={6}><Text size="sm" fw={600}>{it.title}</Text><Badge size="xs" variant="light" color={COLOR[it.type] ?? 'gray'}>{it.source}</Badge></Group>}>
                {it.detail && <Text size="sm">{it.detail}</Text>}
                <Text size="xs" c="dimmed" mt={2}>{fmtDate(it.date)}</Text>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
    </Stack>
  );
}
