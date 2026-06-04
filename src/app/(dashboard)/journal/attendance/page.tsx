'use client';

/**
 * Посещаемость EduPage-style: карточки учеников с аватарами,
 * тап по карточке циклически меняет статус (сразу сохраняется).
 * Отдельный журнал — «не смешивать с оценками» (этап 2).
 * Оптимизировано под телефон.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Avatar, Badge, Button, Group, Loader, Paper, Select, SimpleGrid, Stack, Text, TextInput, Title, UnstyledButton,
} from '@mantine/core';
import { IconArrowLeft, IconCalendarCheck, IconCircleCheck } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface ClassOpt { id: string; grade: number; letter: string }
interface Student { id: string; firstName: string; lastName: string; photo?: string | null }

type AttStatus = 'present' | 'absent' | 'late' | 'excused';
const CYCLE: AttStatus[] = ['present', 'absent', 'late', 'excused'];
const STATUS_META: Record<AttStatus, { label: string; color: string }> = {
  present: { label: 'Присутств.', color: 'teal' },
  absent: { label: 'Отсутств.', color: 'red' },
  late: { label: 'Опоздал', color: 'yellow' },
  excused: { label: 'Уважит.', color: 'blue' },
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function AttendanceScreen() {
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [classId, setClassId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [students, setStudents] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttStatus>>({});
  const [loading, setLoading] = useState(false);
  const [allSaving, setAllSaving] = useState(false);

  useEffect(() => {
    fetch('/api/v1/classes')
      .then((r) => r.json())
      .then((j) => j.success && setClasses(j.data))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([
        fetch(`/api/v1/students?classId=${classId}`),
        fetch(`/api/v1/attendance?classId=${classId}&date=${date}`),
      ]);
      const s = await sRes.json();
      const a = await aRes.json();
      if (s.success) setStudents(s.data);
      const map: Record<string, AttStatus> = {};
      if (a.success) {
        for (const rec of a.data as { studentId: string; status: string }[]) {
          if ((CYCLE as string[]).includes(rec.status)) map[rec.studentId] = rec.status as AttStatus;
        }
      }
      setStatuses(map);
    } finally {
      setLoading(false);
    }
  }, [classId, date]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (studentId: string, status: AttStatus) => {
    setStatuses((m) => ({ ...m, [studentId]: status })); // оптимистично
    fetch('/api/v1/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, date, status }),
    }).catch(() => {});
  };

  const cycle = (studentId: string) => {
    const cur = statuses[studentId];
    const next = cur ? CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length] : 'present';
    setStatus(studentId, next);
  };

  const markAllPresent = async () => {
    setAllSaving(true);
    try {
      const todo = students.filter((s) => !statuses[s.id]);
      setStatuses((m) => {
        const next = { ...m };
        for (const s of todo) next[s.id] = 'present';
        return next;
      });
      await Promise.all(
        todo.map((s) =>
          fetch('/api/v1/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: s.id, date, status: 'present' }),
          }),
        ),
      );
    } finally {
      setAllSaving(false);
    }
  };

  const marked = useMemo(() => Object.keys(statuses).length, [statuses]);
  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.grade}${c.letter}` }));
  const selectedClass = classes.find((c) => c.id === classId);

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between" wrap="wrap">
        <Group gap="xs">
          <IconCalendarCheck size={26} color="var(--mantine-color-teal-6)" />
          <div>
            <Title order={2}>Посещаемость</Title>
            <Text c="dimmed" size="sm">
              {selectedClass ? `${selectedClass.grade}${selectedClass.letter} · ` : ''}
              Тап по карточке: был → нет → опоздал → уважит.
            </Text>
          </div>
        </Group>
        <Button component={Link} href="/journal" variant="subtle" size="xs" leftSection={<IconArrowLeft size={14} />}>
          к журналу
        </Button>
      </Group>

      <Paper withBorder p="md" radius="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <Select label="Класс" data={classOptions} value={classId} onChange={setClassId} searchable w={130} placeholder="6Б" />
          <TextInput label="Дата" type="date" value={date} onChange={(e) => setDate(e.currentTarget.value)} w={160} />
          {classId && (
            <>
              <Button variant="light" color="teal" leftSection={<IconCircleCheck size={16} />} loading={allSaving} onClick={markAllPresent}>
                Все были
              </Button>
              <Badge size="lg" variant="light" radius="sm">
                отмечено {marked} из {students.length}
              </Badge>
            </>
          )}
        </Group>
      </Paper>

      {!classId ? (
        <Text c="dimmed" ta="center" py="lg">Выберите класс.</Text>
      ) : loading ? (
        <Group justify="center" p="md"><Loader size="sm" /></Group>
      ) : (
        <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 5, lg: 6 }} spacing="sm">
          {students.map((st) => {
            const status = statuses[st.id];
            const meta = status ? STATUS_META[status] : null;
            return (
              <UnstyledButton key={st.id} onClick={() => cycle(st.id)}>
                <Paper
                  withBorder
                  p="sm"
                  radius="md"
                  style={{
                    textAlign: 'center',
                    borderColor: meta ? `var(--mantine-color-${meta.color}-5)` : '#e6e9ee',
                    borderWidth: meta ? 2 : 1,
                    backgroundColor: meta ? `var(--mantine-color-${meta.color}-0)` : 'white',
                    transition: 'all 120ms ease',
                  }}
                >
                  <Avatar size={56} radius="50%" mx="auto" src={st.photo || undefined} color="blue">
                    {st.lastName[0]}{st.firstName[0]}
                  </Avatar>
                  <Text size="sm" fw={600} mt={6} lh={1.2} lineClamp={1}>{st.lastName}</Text>
                  <Text size="xs" c="dimmed" lh={1.2} lineClamp={1}>{st.firstName}</Text>
                  <Badge mt={6} size="sm" variant={meta ? 'light' : 'outline'} color={meta?.color ?? 'gray'} radius="sm" fullWidth>
                    {meta?.label ?? 'не отмечен'}
                  </Badge>
                </Paper>
              </UnstyledButton>
            );
          })}
        </SimpleGrid>
      )}
    </Stack>
  );
}

export default function AttendancePage() {
  return (
    <RoleGate roles={['teacher', 'curator', 'zavuch', 'super_admin', 'analyst']}>
      <AttendanceScreen />
    </RoleGate>
  );
}
