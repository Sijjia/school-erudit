'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon, Alert, Badge, Button, Card, Divider, Group, Loader, Modal, NumberInput,
  Paper, ScrollArea, Stack, Text, Textarea, TextInput, Title,
} from '@mantine/core';
import {
  IconSparkles, IconDownload, IconTrash, IconPresentation, IconInfoCircle, IconNotes,
} from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface Slide {
  title: string;
  bullets: string[];
  notes?: string;
}
interface PresentationListItem {
  id: string;
  title: string;
  topic: string;
  subject: string | null;
  gradeLevel: string | null;
  emphasis: string | null;
  model: string | null;
  createdAt: string;
}
interface PresentationFull extends PresentationListItem {
  slides: Slide[];
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function Generator() {
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [emphasis, setEmphasis] = useState('');
  const [slideCount, setSlideCount] = useState<number | string>(8);

  const [items, setItems] = useState<PresentationListItem[]>([]);
  const [llmConfigured, setLlmConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewing, setViewing] = useState<PresentationFull | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/ai/presentations');
      const json = await res.json();
      if (json.success) {
        setItems(json.data.items);
        setLlmConfigured(json.data.llmConfigured);
      }
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = useCallback(async () => {
    if (topic.trim().length < 3) {
      setError('Укажите тему урока');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/ai/presentations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic, subject, gradeLevel, emphasis,
          slideCount: Number(slideCount) || 8,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? 'Не удалось сгенерировать');
        return;
      }
      await load();
      // сразу открыть результат
      setViewing(json.data as PresentationFull);
    } catch {
      setError('Ошибка сети');
    } finally {
      setGenerating(false);
    }
  }, [topic, subject, gradeLevel, emphasis, slideCount, load]);

  const openView = useCallback(async (id: string) => {
    setViewLoading(true);
    try {
      const res = await fetch(`/api/v1/ai/presentations/${id}`);
      const json = await res.json();
      if (json.success) setViewing(json.data as PresentationFull);
    } finally {
      setViewLoading(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    await fetch(`/api/v1/ai/presentations/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <Stack gap="lg" p="md">
      <div>
        <Group gap="xs">
          <IconSparkles size={28} color="var(--mantine-color-blue-6)" />
          <Title order={2}>ИИ-генератор презентаций</Title>
        </Group>
        <Text c="dimmed" size="sm">
          Опишите тему за 10 секунд — ИИ соберёт структуру урока со слайдами и подсказками.
        </Text>
      </div>

      {!llmConfigured && (
        <Alert icon={<IconInfoCircle size={18} />} color="yellow" variant="light">
          ИИ-ключ не настроен (<code>OPENROUTER_API_KEY</code>) — показывается демонстрационный каркас.
          Добавьте ключ, чтобы генерировать реальный контент.
        </Alert>
      )}

      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <TextInput
            label="Тема урока"
            placeholder="Например: Законы Ньютона"
            required
            value={topic}
            onChange={(e) => setTopic(e.currentTarget.value)}
          />
          <Group grow>
            <TextInput
              label="Предмет"
              placeholder="Физика"
              value={subject}
              onChange={(e) => setSubject(e.currentTarget.value)}
            />
            <TextInput
              label="Класс / уровень"
              placeholder="8 класс"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.currentTarget.value)}
            />
            <NumberInput
              label="Слайдов"
              min={3}
              max={20}
              value={slideCount}
              onChange={setSlideCount}
              w={120}
            />
          </Group>
          <Textarea
            label="Особый акцент (необязательно)"
            placeholder="Упор на интерактив и примеры из жизни"
            autosize
            minRows={1}
            value={emphasis}
            onChange={(e) => setEmphasis(e.currentTarget.value)}
          />
          {error && <Text c="red" size="sm">{error}</Text>}
          <Group justify="flex-end">
            <Button
              leftSection={<IconSparkles size={18} />}
              onClick={generate}
              loading={generating}
            >
              Сгенерировать
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Divider label="Мои презентации" labelPosition="left" />

      {loading ? (
        <Group justify="center" p="xl"><Loader /></Group>
      ) : items.length === 0 ? (
        <Text c="dimmed" ta="center" py="lg">Пока нет презентаций — создайте первую выше.</Text>
      ) : (
        <Stack gap="xs">
          {items.map((p) => (
            <Card key={p.id} withBorder radius="md" padding="sm">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <IconPresentation size={22} color="var(--mantine-color-blue-6)" />
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} truncate>{p.title}</Text>
                    <Text size="xs" c="dimmed">
                      {[p.subject, p.gradeLevel].filter(Boolean).join(' · ') || p.topic} · {fmtDate(p.createdAt)}
                      {p.model === 'stub' && ' · демо'}
                    </Text>
                  </div>
                </Group>
                <Group gap={4} wrap="nowrap">
                  <Button size="xs" variant="light" onClick={() => openView(p.id)} loading={viewLoading}>
                    Открыть
                  </Button>
                  <ActionIcon
                    component="a"
                    href={`/api/v1/ai/presentations/${p.id}/pptx`}
                    variant="subtle"
                    color="blue"
                    title="Скачать .pptx"
                  >
                    <IconDownload size={18} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => remove(p.id)} title="Удалить">
                    <IconTrash size={18} />
                  </ActionIcon>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Modal
        opened={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.title}
        size="lg"
        scrollAreaComponent={ScrollArea.Autosize}
      >
        {viewing && (
          <Stack gap="md">
            <Group gap="xs">
              {viewing.model === 'stub'
                ? <Badge color="yellow" variant="light">демо-каркас</Badge>
                : <Badge color="blue" variant="light">{viewing.model}</Badge>}
              <Button
                size="xs"
                variant="light"
                leftSection={<IconDownload size={16} />}
                component="a"
                href={`/api/v1/ai/presentations/${viewing.id}/pptx`}
              >
                Скачать .pptx
              </Button>
            </Group>
            {viewing.slides.map((s, i) => (
              <Card key={i} withBorder radius="md" padding="md">
                <Group gap="xs" mb="xs">
                  <Badge variant="filled" radius="sm">{i + 1}</Badge>
                  <Text fw={700}>{s.title}</Text>
                </Group>
                <Stack gap={4}>
                  {s.bullets.map((b, j) => (
                    <Text key={j} size="sm">• {b}</Text>
                  ))}
                </Stack>
                {s.notes && (
                  <Group gap={6} mt="sm" align="flex-start" wrap="nowrap">
                    <IconNotes size={16} color="var(--mantine-color-gray-6)" style={{ marginTop: 2 }} />
                    <Text size="xs" c="dimmed" fs="italic">{s.notes}</Text>
                  </Group>
                )}
              </Card>
            ))}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

export default function PresentationsPage() {
  return (
    <RoleGate roles={['teacher', 'curator', 'zavuch', 'super_admin', 'analyst']}>
      <Generator />
    </RoleGate>
  );
}
