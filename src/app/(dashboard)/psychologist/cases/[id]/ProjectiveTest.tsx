'use client';

import { useRef, useState } from 'react';
import { Badge, Button, Card, Group, Paper, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { IconPhoto, IconWand, IconCheck, IconShieldLock } from '@tabler/icons-react';

interface TestResult { id: string; aiInterpretation: string | null; isHumanVerified: boolean; rawScores?: { methodology?: string } | null }

export function ProjectiveTest({ caseId, tests, onSaved }: { caseId: string; tests: TestResult[]; onSaved: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasImage, setHasImage] = useState(false);
  const [methodology, setMethodology] = useState('Несуществующее животное');
  const [draft, setDraft] = useState('');
  const [source, setSource] = useState('');
  const [testId, setTestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const originalRef = useRef<string>(''); // оригинал (до блюра) — для цифрового сейфа

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const cv = canvasRef.current!;
      const maxW = 480;
      const scale = Math.min(1, maxW / img.width);
      cv.width = img.width * scale; cv.height = img.height * scale;
      cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
      originalRef.current = cv.toDataURL('image/png'); // снимок оригинала ДО блюра
      setHasImage(true); setDraft(''); setTestId(null); setSource('');
    };
    img.src = URL.createObjectURL(file);
  }

  // пиксселизация выделенной области (скрытие рукописной подписи ДО отправки)
  function pixelate(x: number, y: number, w: number, h: number) {
    const cv = canvasRef.current!; const ctx = cv.getContext('2d')!;
    if (w < 4 || h < 4) return;
    const sw = Math.max(1, Math.round(w / 12)), sh = Math.max(1, Math.round(h / 12));
    const tmp = document.createElement('canvas'); tmp.width = sw; tmp.height = sh;
    tmp.getContext('2d')!.drawImage(cv, x, y, w, h, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, sw, sh, x, y, w, h);
  }

  function pos(e: React.MouseEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function down(e: React.MouseEvent) { drag.current = pos(e); }
  function up(e: React.MouseEvent) {
    if (!drag.current) return;
    const a = drag.current, b = pos(e);
    pixelate(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    drag.current = null;
  }

  async function analyze() {
    if (!hasImage) return;
    setBusy(true);
    const imageBase64 = canvasRef.current!.toDataURL('image/png'); // заблюренная — в облако
    const res = await fetch('/api/v1/psy/vision', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // originalBase64 — оригинал в приватный сейф; imageBase64 (блюр) — в vision
      body: JSON.stringify({ caseId, imageBase64, originalBase64: originalRef.current, methodology }),
    });
    const j = await res.json();
    setBusy(false);
    if (j.success) { setDraft(j.data.draft); setSource(j.data.source); setTestId(j.data.id); onSaved(); }
  }

  async function verify() {
    if (!testId) return;
    await fetch(`/api/v1/psy/tests/${testId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aiInterpretation: draft, isHumanVerified: true }),
    });
    setTestId(null); setDraft(''); setHasImage(false); onSaved();
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Group gap="xs" mb="sm"><IconPhoto size={20} color="#e8590c" /><Title order={5}>Проективный тест (рисунок)</Title></Group>

      {tests.length > 0 && (
        <Stack gap="xs" mb="md">
          {tests.map((t) => (
            <Card key={t.id} withBorder padding="xs" radius="sm">
              <Group justify="space-between">
                <Text size="sm" fw={500}>{t.rawScores?.methodology ?? 'Методика'}</Text>
                {t.isHumanVerified ? <Badge color="green" leftSection={<IconCheck size={12} />}>Проверено</Badge> : <Badge color="orange">Черновик</Badge>}
              </Group>
              {t.aiInterpretation && <Text size="sm" c="dimmed" mt={4} lineClamp={3}>{t.aiInterpretation}</Text>}
            </Card>
          ))}
        </Stack>
      )}

      <Stack gap="sm">
        <TextInput label="Методика" value={methodology} onChange={(e) => setMethodology(e.currentTarget.value)} />
        <input type="file" accept="image/*" onChange={onFile} />
        <Text size="xs" c="dimmed">Загрузите рисунок. Перетащите мышью по подписи/имени — область будет размыта <b>до</b> отправки в AI.</Text>
        <canvas ref={canvasRef} onMouseDown={down} onMouseUp={up}
          style={{ border: '1px solid #dee2e6', borderRadius: 8, cursor: hasImage ? 'crosshair' : 'default', maxWidth: '100%', display: hasImage ? 'block' : 'none' }} />
        {hasImage && (
          <Group>
            <Button leftSection={<IconWand size={16} />} loading={busy} onClick={analyze}>Анализировать</Button>
          </Group>
        )}
        {draft && (
          <Stack gap="xs">
            <Group gap={6}><IconShieldLock size={14} color="#2f9e44" /><Text size="xs" c="dimmed">Источник: <b>{source === 'llm' ? 'Vision (облако)' : 'локальный черновик'}</b>. В облако ушёл рисунок с заблюренными подписями.</Text></Group>
            <Textarea label="Черновик заключения (проверьте и скорректируйте)" autosize minRows={3} value={draft} onChange={(e) => setDraft(e.currentTarget.value)} />
            <Group justify="flex-end"><Button color="green" leftSection={<IconCheck size={16} />} onClick={verify}>Подтвердить (я проверил)</Button></Group>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
