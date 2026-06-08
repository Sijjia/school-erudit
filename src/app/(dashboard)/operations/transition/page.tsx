'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Checkbox, Group, Paper, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconArrowBigUpLines, IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface Move { from: string; to: string; students: number; targetExists: boolean }
interface Analysis { moves: Move[]; graduates: number; promoted: number }

function Transition() {
  const [year, setYear] = useState('2027–2028');
  const [renew, setRenew] = useState(true);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [result, setResult] = useState<{ graduated: number; promoted: number; renewed: number; createdClasses: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function run(mode: 'analyze' | 'apply') {
    setBusy(true);
    const res = await fetch('/api/v1/operations/transition', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, year, renewContracts: renew }),
    });
    const j = await res.json();
    setBusy(false);
    if (!j.success) return;
    if (mode === 'analyze') { setAnalysis(j.data); setResult(null); }
    else { setResult(j.data); setAnalysis(null); setConfirm(false); }
  }

  return (
    <Stack gap="lg" p="md">
      <Group gap="xs"><IconArrowBigUpLines size={26} color="#1971c2" /><Title order={2}>Перевод учебного года</Title></Group>
      <Text c="dimmed" size="sm">Массовый перевод: ученики поднимаются по лестнице (6В→7В…), последний класс → выпуск, договоры продлеваются. Сначала «Анализировать», потом «Применить».</Text>

      <Paper withBorder p="md" radius="md">
        <Group align="flex-end" gap="md">
          <TextInput label="Новый учебный год" value={year} onChange={(e) => setYear(e.currentTarget.value)} w={200} />
          <Checkbox label="Продлить договоры" checked={renew} onChange={(e) => setRenew(e.currentTarget.checked)} />
          <Button variant="light" loading={busy} onClick={() => run('analyze')}>Анализировать</Button>
        </Group>
      </Paper>

      {analysis && (
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" mb="sm">
            <Title order={5}>Предпросмотр</Title>
            <Group gap="xs">
              <Badge color="blue" variant="light">К переводу: {analysis.promoted}</Badge>
              <Badge color="teal" variant="light">Выпуск: {analysis.graduates}</Badge>
            </Group>
          </Group>
          <Table>
            <Table.Thead><Table.Tr><Table.Th>Из класса</Table.Th><Table.Th>В класс</Table.Th><Table.Th>Учеников</Table.Th><Table.Th>Целевой класс</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {analysis.moves.map((m, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{m.from}</Table.Td>
                  <Table.Td><b>{m.to}</b></Table.Td>
                  <Table.Td>{m.students}</Table.Td>
                  <Table.Td>{m.to === 'Выпуск' ? '—' : m.targetExists ? <Badge color="green" variant="light">есть</Badge> : <Badge color="orange" variant="light">создастся</Badge>}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {!confirm ? (
            <Button color="orange" mt="md" leftSection={<IconAlertTriangle size={16} />} onClick={() => setConfirm(true)}>Применить перевод года…</Button>
          ) : (
            <Alert color="red" mt="md" title="Подтверждение" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm" mb="xs">Операция массово изменит классы учеников. Откатить нельзя автоматически.</Text>
              <Group>
                <Button color="red" loading={busy} onClick={() => run('apply')}>Да, выполнить</Button>
                <Button variant="subtle" color="gray" onClick={() => setConfirm(false)}>Отмена</Button>
              </Group>
            </Alert>
          )}
        </Paper>
      )}

      {result && (
        <Alert color="green" title="Перевод года выполнен" icon={<IconCheck size={16} />}>
          Переведено: <b>{result.promoted}</b> · выпущено: <b>{result.graduated}</b> · продлено договоров: <b>{result.renewed}</b> · создано классов: <b>{result.createdClasses}</b>
        </Alert>
      )}
    </Stack>
  );
}

export default function TransitionPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary']}>
      <Transition />
    </RoleGate>
  );
}
