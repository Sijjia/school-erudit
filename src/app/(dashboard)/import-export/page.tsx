'use client';

import { useRef, useState } from 'react';
import { Alert, Button, Group, Paper, Stack, Text, Textarea, Title } from '@mantine/core';
import { IconDownload, IconUpload, IconFileSpreadsheet } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

function ImportExport() {
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<{ created: number; total: number; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => setCsv(String(r.result || ''));
    r.readAsText(f, 'utf-8');
  }

  async function doImport() {
    if (!csv.trim()) return;
    setBusy(true); setResult(null);
    const res = await fetch('/api/v1/io/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv }) });
    const j = await res.json();
    setBusy(false);
    if (j.success) setResult(j.data);
  }

  return (
    <Stack gap="lg" p="md">
      <Group gap="xs"><IconFileSpreadsheet size={26} color="#2f9e44" /><Title order={2}>Импорт / Экспорт</Title></Group>

      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="xs">Экспорт учеников</Title>
        <Text c="dimmed" size="sm" mb="sm">Выгрузить активных учеников текущего филиала в CSV (открывается в Excel).</Text>
        <Button component="a" href="/api/v1/io/students" leftSection={<IconDownload size={16} />}>Скачать students.csv</Button>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Title order={5} mb="xs">Импорт учеников</Title>
        <Text c="dimmed" size="sm" mb="sm">Колонки: Фамилия, Имя, Отчество, Класс, Буква, (Статус). Класс создаётся автоматически, если его нет.</Text>
        <Group gap="xs" mb="sm">
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onFile} />
          <Button variant="light" leftSection={<IconUpload size={14} />} onClick={() => fileRef.current?.click()}>Выбрать CSV-файл</Button>
        </Group>
        <Textarea placeholder={'Фамилия,Имя,Отчество,Класс,Буква\nИванов,Иван,Иванович,5,А'} autosize minRows={4} value={csv} onChange={(e) => setCsv(e.currentTarget.value)} />
        <Group justify="flex-end" mt="sm">
          <Button loading={busy} onClick={doImport} disabled={!csv.trim()}>Импортировать</Button>
        </Group>
        {result && (
          <Alert color={result.errors.length ? 'orange' : 'green'} mt="md" title={`Загружено: ${result.created} из ${result.total}`}>
            {result.errors.length > 0 && <Stack gap={2}>{result.errors.map((e, i) => <Text key={i} size="xs">{e}</Text>)}</Stack>}
          </Alert>
        )}
      </Paper>
    </Stack>
  );
}

export default function ImportExportPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary']}>
      <ImportExport />
    </RoleGate>
  );
}
