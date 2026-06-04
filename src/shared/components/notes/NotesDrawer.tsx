'use client';

import { useEffect, useState } from 'react';
import { Badge, Drawer, Group, Loader, Paper, Stack, Text } from '@mantine/core';
import { noteTypeInfo } from '@/shared/lib/note-types';

/**
 * История заметок ученика (EduPage-style «Уведомления/письма»):
 * список замечаний с эмодзи-типом, датой, статусом и описанием.
 */

interface Incident {
  id: string;
  type: string;
  description: string;
  status: string;
  parentNotified: boolean;
  createdAt: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Новое', color: 'yellow' },
  moderated: { label: 'Одобрено', color: 'teal' },
  resolved: { label: 'Решено', color: 'green' },
};

export function NotesDrawer({
  studentId,
  studentName,
  onClose,
  refreshKey = 0,
}: {
  studentId: string | null;
  studentName?: string;
  onClose: () => void;
  refreshKey?: number;
}) {
  const [items, setItems] = useState<Incident[] | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setItems(null);
    fetch(`/api/v1/students/${studentId}/incidents`)
      .then((r) => r.json())
      .then((j) => setItems(j.success ? j.data : []))
      .catch(() => setItems([]));
  }, [studentId, refreshKey]);

  return (
    <Drawer opened={!!studentId} onClose={onClose} position="right" title={`Заметки — ${studentName ?? ''}`} size="md">
      {!items ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      ) : items.length === 0 ? (
        <Text c="dimmed" ta="center" py="lg">
          Заметок пока нет
        </Text>
      ) : (
        <Stack gap="sm">
          {items.map((i) => {
            const info = noteTypeInfo(i.type);
            const st = STATUS_LABEL[i.status] ?? { label: i.status, color: 'gray' };
            return (
              <Paper key={i.id} withBorder p="sm" radius="md" style={{ borderLeft: `4px solid var(--mantine-color-${info.color}-5)` }}>
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Group gap={8} wrap="nowrap" align="flex-start">
                    <Text style={{ fontSize: 20 }}>{info.emoji}</Text>
                    <div>
                      <Text size="sm" fw={600}>
                        {info.label}
                      </Text>
                      {i.description && i.description !== info.label && (
                        <Text size="xs" c="dimmed" mt={2}>
                          {i.description}
                        </Text>
                      )}
                    </div>
                  </Group>
                  <Stack gap={4} align="flex-end">
                    <Badge size="xs" color={st.color} variant="light">
                      {st.label}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {new Date(i.createdAt).toLocaleDateString('ru-RU')}
                    </Text>
                  </Stack>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Drawer>
  );
}
