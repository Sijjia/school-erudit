'use client';

import { useEffect, useState, useRef } from 'react';
import { Badge, Button, Group, NumberInput, Paper, Select, Stack, Text, Title } from '@mantine/core';
import { IconCalculator, IconCamera, IconDeviceFloppy } from '@tabler/icons-react';

interface Tpl { id: string; name: string; version: number; isActive: boolean; schema: { metric?: string; scaleMin?: number; scaleMax?: number; questions?: { text: string; type: string }[] } }

export function ScoreTest({ caseId, onSaved }: { caseId: string; onSaved: () => void }) {
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [tplId, setTplId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/v1/psy/templates').then((r) => r.json()).then((j) => setTpls((j.data ?? []).filter((t: Tpl) => t.isActive))).catch(() => {});
  }, []);

  const tpl = tpls.find((t) => t.id === tplId);
  const scaleQs = (tpl?.schema.questions ?? []).filter((q) => (q.type ?? 'scale') === 'scale');
  const scaleMax = tpl?.schema.scaleMax ?? 10;
  const total = answers.reduce((s, v) => s + (v || 0), 0);

  function pickTpl(id: string | null) {
    setTplId(id); setSource('');
    const t = tpls.find((x) => x.id === id);
    const qs = (t?.schema.questions ?? []).filter((q) => (q.type ?? 'scale') === 'scale');
    setAnswers(qs.map(() => 0));
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !tplId) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      const res = await fetch('/api/v1/psy/omr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, templateId: tplId, imageBase64: reader.result }),
      });
      const j = await res.json(); setBusy(false);
      if (j.success) { setAnswers(j.data.scores); setSource(j.data.source); }
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    if (!tplId) return;
    setBusy(true);
    const res = await fetch(`/api/v1/psy/cases/${caseId}/score`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: tplId, answers }),
    });
    setBusy(false);
    if ((await res.json()).success) { setTplId(null); setAnswers([]); setSource(''); onSaved(); }
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Group gap="xs" mb="sm"><IconCalculator size={20} color="#7048e8" /><Title order={5}>Тест по методике (авто-расчёт шкалы)</Title></Group>
      <Stack gap="sm">
        <Select label="Методика" placeholder="Выберите методику" value={tplId} onChange={pickTpl}
          data={tpls.map((t) => ({ value: t.id, label: `${t.name} (v${t.version})` }))} />
        {tpl && (
          <>
            <Group gap="xs">
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onFile} />
              <Button size="xs" variant="light" leftSection={<IconCamera size={14} />} loading={busy} onClick={() => fileRef.current?.click()}>
                Распознать бланк (камера)
              </Button>
              {source && <Badge color={source === 'llm' ? 'grape' : 'gray'} variant="light">{source === 'llm' ? 'распознано AI' : 'черновик — проверьте'}</Badge>}
            </Group>
            {scaleQs.length === 0 ? <Text size="sm" c="dimmed">В методике нет шкальных вопросов — добавьте их в конструкторе.</Text> : (
              <Stack gap={6}>
                {scaleQs.map((q, i) => (
                  <Group key={i} gap="sm" wrap="nowrap">
                    <Text size="sm" style={{ flex: 1 }}>{q.text || `Вопрос ${i + 1}`}</Text>
                    <NumberInput w={90} min={0} max={scaleMax} value={answers[i] ?? 0}
                      onChange={(v) => setAnswers((a) => a.map((x, j) => (j === i ? Number(v) || 0 : x)))} />
                  </Group>
                ))}
              </Stack>
            )}
            <Group justify="space-between">
              <Text fw={600}>Сырой балл по «{tpl.schema.metric ?? 'шкале'}»: {total}</Text>
              <Button leftSection={<IconDeviceFloppy size={16} />} loading={busy} onClick={save} disabled={scaleQs.length === 0}>
                Сохранить результат
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Paper>
  );
}
