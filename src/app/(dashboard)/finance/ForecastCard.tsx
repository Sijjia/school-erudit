'use client';

import { useEffect, useState } from 'react';
import { Badge, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { IconTrendingUp } from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';

interface Forecast { months: { label: string; expected: number; overdue: number }[]; totalExpected: number; totalOverdue: number; activePromises: number }

const fmt = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} сом`;

/** Прогноз прихода («дезографы»): ожидаемые поступления по месяцам + обещания колл-центра. */
export function ForecastCard() {
  const [d, setD] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/v1/finance/forecast').then((r) => r.json()).then((j) => setD(j.data ?? null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Paper withBorder p="md" radius="md"><Group justify="center"><Loader size="sm" /></Group></Paper>;
  if (!d) return null;

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="xs">
        <Group gap="xs"><IconTrendingUp size={20} color="#2f9e44" /><Title order={5}>Прогноз прихода</Title></Group>
        <Group gap="xs">
          <Badge color="teal" variant="light">Ожидается: {fmt(d.totalExpected)}</Badge>
          {d.totalOverdue > 0 && <Badge color="red" variant="light">в т.ч. просрочено: {fmt(d.totalOverdue)}</Badge>}
          {d.activePromises > 0 && <Badge color="orange" variant="light">обещаний: {d.activePromises}</Badge>}
        </Group>
      </Group>
      {d.months.length === 0 ? <Text c="dimmed" size="sm">Нет ожидаемых поступлений.</Text> : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={d.months}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} width={70} tickFormatter={(v) => `${Math.round(v / 1000)}к`} />
            <RTooltip formatter={(v) => fmt(Number(v))} />
            <Bar dataKey="expected" name="Ожидается" fill="#2f9e44" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
}
