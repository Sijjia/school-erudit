'use client';

import { useEffect, useState } from 'react';
import {
  ActionIcon, Badge, Button, Card, Group, Loader, Modal, NumberInput, Paper, Select, Stack,
  Text, TextInput, Title,
} from '@mantine/core';
import { IconTool, IconPlus, IconTrash, IconVersions } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface Question { text: string; type: 'scale' | 'text' | 'symptom' }
interface Schema { metric?: string; scaleMin?: number; scaleMax?: number; questions?: Question[] }
interface Template {
  id: string; name: string; version: number; parentTemplateId: string | null;
  isActive: boolean; schema: Schema; mappingRule: { op?: string; factor?: number } | null;
}

const QTYPE = { scale: 'Шкала', text: 'Текст', symptom: 'Симптом', file: 'Загрузка файла' };

function Constructor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [verOpen, setVerOpen] = useState<Template | null>(null);

  async function load() {
    setLoading(true);
    const j = await fetch('/api/v1/psy/templates').then((r) => r.json()).catch(() => ({ data: [] }));
    setTemplates(j.data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // группировка по линейке (root)
  const groups = templates.reduce<Record<string, Template[]>>((acc, t) => {
    const root = t.parentTemplateId ?? t.id;
    (acc[root] ??= []).push(t);
    return acc;
  }, {});

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Group gap="xs"><IconTool size={26} color="#7048e8" /><Title order={2}>Конструктор методик</Title></Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>Новая методика</Button>
      </Group>
      <Text c="dimmed" size="sm">Соберите тест за 5 минут (вопросы, шкалы 1–10, симптомы). Версионирование сохраняет статистику прошлых лет.</Text>

      {loading ? <Group justify="center" p="xl"><Loader /></Group>
        : Object.keys(groups).length === 0 ? <Text c="dimmed" ta="center" py="xl">Методик пока нет.</Text>
        : (
          <Stack gap="md">
            {Object.values(groups).map((versions) => {
              const sorted = [...versions].sort((a, b) => b.version - a.version);
              const head = sorted[0];
              return (
                <Card key={head.id} withBorder radius="md">
                  <Group justify="space-between">
                    <div>
                      <Group gap="xs">
                        <Text fw={600}>{head.name}</Text>
                        {sorted.map((v) => (
                          <Badge key={v.id} variant={v.isActive ? 'filled' : 'light'} color={v.isActive ? 'grape' : 'gray'}>
                            v{v.version}{v.isActive ? ' (активна)' : ''}
                          </Badge>
                        ))}
                      </Group>
                      <Text size="sm" c="dimmed" mt={4}>
                        Метрика: {head.schema.metric ?? '—'} · шкала {head.schema.scaleMin ?? 1}–{head.schema.scaleMax ?? 10} · вопросов: {head.schema.questions?.length ?? 0}
                      </Text>
                      {head.mappingRule?.op && <Text size="xs" c="teal">Mapping: {head.mappingRule.op} × {head.mappingRule.factor}</Text>}
                    </div>
                    <Button size="xs" variant="light" leftSection={<IconVersions size={14} />} onClick={() => setVerOpen(head)}>Новая версия</Button>
                  </Group>
                </Card>
              );
            })}
          </Stack>
        )}

      <CreateModal opened={createOpen} onClose={() => setCreateOpen(false)} onDone={() => { setCreateOpen(false); load(); }} />
      {verOpen && <VersionModal source={verOpen} onClose={() => setVerOpen(null)} onDone={() => { setVerOpen(null); load(); }} />}
    </Stack>
  );
}

function QuestionEditor({ questions, setQuestions }: { questions: Question[]; setQuestions: (q: Question[]) => void }) {
  return (
    <Stack gap="xs">
      {questions.map((q, i) => (
        <Group key={i} gap="xs" wrap="nowrap">
          <TextInput style={{ flex: 1 }} placeholder="Текст вопроса" value={q.text}
            onChange={(e) => setQuestions(questions.map((x, j) => j === i ? { ...x, text: e.currentTarget.value } : x))} />
          <Select w={130} data={Object.entries(QTYPE).map(([v, l]) => ({ value: v, label: l }))} value={q.type}
            onChange={(v) => setQuestions(questions.map((x, j) => j === i ? { ...x, type: (v as Question['type']) } : x))} />
          <ActionIcon color="red" variant="light" onClick={() => setQuestions(questions.filter((_, j) => j !== i))}><IconTrash size={16} /></ActionIcon>
        </Group>
      ))}
      <Button size="xs" variant="subtle" leftSection={<IconPlus size={14} />} onClick={() => setQuestions([...questions, { text: '', type: 'scale' }])}>Добавить вопрос</Button>
    </Stack>
  );
}

function CreateModal({ opened, onClose, onDone }: { opened: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [metric, setMetric] = useState('');
  const [scaleMin, setScaleMin] = useState<number>(1);
  const [scaleMax, setScaleMax] = useState<number>(10);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) { setErr('Нужно название'); return; }
    setSaving(true); setErr('');
    const res = await fetch('/api/v1/psy/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, metric, scaleMin, scaleMax, questions: questions.filter((q) => q.text.trim()) }) });
    const j = await res.json(); setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    setName(''); setMetric(''); setQuestions([]); onDone();
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Новая методика" centered size="lg">
      <Stack gap="md">
        <TextInput label="Название" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput label="Измеряемая метрика" placeholder="напр.: тревожность" value={metric} onChange={(e) => setMetric(e.currentTarget.value)} />
        <Group grow>
          <NumberInput label="Шкала от" value={scaleMin} onChange={(v) => setScaleMin(Number(v) || 0)} />
          <NumberInput label="Шкала до" value={scaleMax} onChange={(v) => setScaleMax(Number(v) || 0)} />
        </Group>
        <div><Text size="sm" fw={500} mb={4}>Вопросы</Text><QuestionEditor questions={questions} setQuestions={setQuestions} /></div>
        {err && <Text c="red" size="sm">{err}</Text>}
        <Group justify="flex-end"><Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button><Button onClick={submit} loading={saving}>Создать</Button></Group>
      </Stack>
    </Modal>
  );
}

function VersionModal({ source, onClose, onDone }: { source: Template; onClose: () => void; onDone: () => void }) {
  const [scaleMax, setScaleMax] = useState<number>(source.schema.scaleMax ?? 10);
  const [questions, setQuestions] = useState<Question[]>(source.schema.questions ?? []);
  const [mapOp, setMapOp] = useState('divide');
  const [mapFactor, setMapFactor] = useState<number>(2);
  const [needMapping, setNeedMapping] = useState(false);
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);

  const scaleChanged = scaleMax !== (source.schema.scaleMax ?? 10);

  async function submit() {
    setSaving(true); setErr('');
    const payload: Record<string, unknown> = { schema: { ...source.schema, scaleMax, questions: questions.filter((q) => q.text.trim()) } };
    if (scaleChanged) payload.mappingRule = { op: mapOp, factor: mapFactor };
    const res = await fetch(`/api/v1/psy/templates/${source.id}/version`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await res.json(); setSaving(false);
    if (res.status === 409) { setNeedMapping(true); setErr(j.error?.message ?? 'Задайте правило пересчёта'); return; }
    if (!j.success) { setErr(j.error?.message ?? 'Ошибка'); return; }
    onDone();
  }

  return (
    <Modal opened onClose={onClose} title={`Новая версия: ${source.name} (текущая v${source.version})`} centered size="lg">
      <Stack gap="md">
        <NumberInput label="Шкала до" description="Если изменить — потребуется правило пересчёта старых графиков." value={scaleMax} onChange={(v) => setScaleMax(Number(v) || 0)} />
        <div><Text size="sm" fw={500} mb={4}>Вопросы</Text><QuestionEditor questions={questions} setQuestions={setQuestions} /></div>
        {(scaleChanged || needMapping) && (
          <Paper withBorder p="sm" radius="sm" bg="orange.0">
            <Text size="sm" fw={500} mb={4}>Правило пересчёта (Mapping Rule)</Text>
            <Group grow>
              <Select data={[{ value: 'divide', label: 'Разделить на' }, { value: 'multiply', label: 'Умножить на' }]} value={mapOp} onChange={(v) => setMapOp(v ?? 'divide')} />
              <NumberInput value={mapFactor} onChange={(v) => setMapFactor(Number(v) || 1)} />
            </Group>
          </Paper>
        )}
        {err && <Text c="red" size="sm">{err}</Text>}
        <Group justify="flex-end"><Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button><Button onClick={submit} loading={saving}>Сохранить как новую версию</Button></Group>
      </Stack>
    </Modal>
  );
}

export default function ConstructorPage() {
  return (
    <RoleGate roles={['senior_psychologist', 'super_admin']}>
      <Constructor />
    </RoleGate>
  );
}
