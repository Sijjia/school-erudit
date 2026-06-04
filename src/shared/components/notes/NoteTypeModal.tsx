'use client';

import { useState } from 'react';
import { Button, Group, Modal, SimpleGrid, Stack, Text, Textarea, UnstyledButton } from '@mantine/core';
import { NOTE_TYPES } from '@/shared/lib/note-types';

/**
 * Модал «Новая заметка» (EduPage-style): сетка плиток-типов с эмодзи +
 * необязательный комментарий → POST /api/v1/students/[id]/incidents.
 */
export function NoteTypeModal({
  opened,
  onClose,
  studentId,
  studentName,
  onSaved,
}: {
  opened: boolean;
  onClose: () => void;
  studentId: string | null;
  studentName?: string;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const close = () => {
    setSelected(null);
    setComment('');
    onClose();
  };

  const save = async () => {
    if (!selected || !studentId) return;
    setSaving(true);
    try {
      const type = NOTE_TYPES.find((t) => t.key === selected)!;
      const res = await fetch(`/api/v1/students/${studentId}/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type.key, description: comment.trim() || type.label }),
      });
      if ((await res.json()).success) {
        onSaved();
        close();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={close} title={`Новая заметка${studentName ? ` — ${studentName}` : ''}`} size="lg" centered>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing={8}>
          {NOTE_TYPES.map((t) => (
            <UnstyledButton
              key={t.key}
              onClick={() => setSelected(t.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: selected === t.key ? `2px solid var(--mantine-color-${t.color}-5)` : '1px solid #e6e9ee',
                backgroundColor: selected === t.key ? `var(--mantine-color-${t.color}-0)` : 'white',
              }}
            >
              <Text style={{ fontSize: 22 }}>{t.emoji}</Text>
              <Text size="sm" fw={500} lh={1.25}>
                {t.label}
              </Text>
            </UnstyledButton>
          ))}
        </SimpleGrid>
        <Textarea
          placeholder="Комментарий (необязательно): опоздал на 15 минут…"
          autosize
          minRows={2}
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Отмена
          </Button>
          <Button onClick={save} loading={saving} disabled={!selected}>
            Сохранить заметку
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
