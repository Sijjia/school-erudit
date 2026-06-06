'use client';

/**
 * Журнал EduPage-style (этап 2): назначения как колонки с очками,
 * среднее число → вычисленная (примерная) → итоговая оценка (через модерацию),
 * заметки-замечания с типами. Посещаемость — отдельный экран /journal/attendance.
 * Старый вид сохранён на /journal/classic.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ActionIcon, Avatar, Badge, Button, Group, Loader, Menu, Modal, NumberInput,
  Paper, ScrollArea, Select, Stack, Table, Text, TextInput, Title, Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBook2, IconCalendarCheck, IconCheck, IconDots, IconHistory, IconPencil, IconPlus, IconPrinter, IconSearch, IconTrash,
} from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { useRole } from '@/shared/hooks/useRole';
import { EditableGradeBadge } from '@/shared/components/grading/EditableGradeBadge';
import { NoteTypeModal } from '@/shared/components/notes/NoteTypeModal';
import { NotesDrawer } from '@/shared/components/notes/NotesDrawer';

interface Pair { subjectId: string; subjectName: string; classId: string; className: string }
interface Period { id: string; name: string; isActive: boolean }
interface Student { id: string; firstName: string; lastName: string; photo?: string | null }
interface Category { id: string; name: string; weight: number }
interface Assignment { id: string; title: string; shortName?: string | null; maxPoints: number; date: string; categoryId?: string | null }
interface Grade {
  id: string; studentId: string; value: number; assignmentId?: string | null; status?: string;
  scale?: string;
  category: { id: string; name: string; weight: number }; editWindowExpired?: boolean;
}

/** Оценка → 5-балльный эквивалент (старые HUNDRED делим на 20). */
function gradeToFive(gr: Grade): number {
  return gr.scale === 'HUNDRED' || gr.value > 5 ? gr.value / 20 : gr.value;
}

const SEC = 'var(--mantine-color-dimmed)';

/** Перевод процента в 5-балльную «вычисленную» оценку. */
function computeFive(percent: number): number {
  if (percent >= 85) return 5;
  if (percent >= 70) return 4;
  if (percent >= 55) return 3;
  return 2;
}
const FIVE_COLOR: Record<number, string> = { 5: 'teal', 4: 'green', 3: 'yellow', 2: 'red' };

const FINAL_STATUS: Record<string, { label: string; color: string }> = {
  submitted: { label: 'на модерации', color: 'yellow' },
  moderated: { label: 'одобрена', color: 'teal' },
  published: { label: 'итоговая', color: 'green' },
  draft: { label: 'черновик', color: 'gray' },
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const fmtDM = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

/** Красный toast об ошибке сохранения (журнал раньше молчал — теперь говорит). */
function toastError(message: string) {
  notifications.show({ color: 'red', title: 'Ошибка', message });
}

function Journal() {
  const { role } = useRole();
  const canDelete = role === 'zavuch' || role === 'super_admin' || role === 'analyst';

  const [loading, setLoading] = useState(true);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const [pairKey, setPairKey] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [gridLoading, setGridLoading] = useState(false);

  // ввод балла в ячейку
  const [editCell, setEditCell] = useState<{ studentId: string; assignmentId: string } | null>(null);
  const [cellValue, setCellValue] = useState<number | ''>('');
  const [cellSaving, setCellSaving] = useState(false);

  // модал назначения (создание/редактирование)
  const [asgModal, setAsgModal] = useState<{ mode: 'create' | 'edit'; asg?: Assignment } | null>(null);
  const [asgForm, setAsgForm] = useState({ title: '', shortName: '', categoryId: '' as string | null, maxPoints: 100, date: todayISO() });
  const [asgSaving, setAsgSaving] = useState(false);

  // итоговые
  const [finalsOpen, setFinalsOpen] = useState(false);
  const [finalDrafts, setFinalDrafts] = useState<Record<string, number>>({});
  const [finalsSaving, setFinalsSaving] = useState(false);

  // поиск ученика в таблице (клиентский фильтр)
  const [studentQuery, setStudentQuery] = useState('');

  // заметки
  const [noteFor, setNoteFor] = useState<Student | null>(null);
  const [notesViewFor, setNotesViewFor] = useState<Student | null>(null);
  const [notesRefresh, setNotesRefresh] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [optRes, catsRes] = await Promise.all([
          fetch('/api/v1/curriculum-plan/options'),
          fetch('/api/v1/grading/categories'),
        ]);
        const opt = await optRes.json();
        const cats = await catsRes.json();
        if (opt.success) {
          setPairs(opt.data.pairs);
          setPeriods(opt.data.periods);
          setTeacherId(opt.data.teacherId ?? null);
          const active = opt.data.periods.find((p: Period) => p.isActive);
          setPeriodId(active?.id ?? opt.data.periods[0]?.id ?? null);
        }
        if (cats.success) {
          const seen = new Set<string>();
          const uniq: Category[] = [];
          for (const c of cats.data as Category[]) if (!seen.has(c.name)) { seen.add(c.name); uniq.push(c); }
          setCategories(uniq);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const selected = useMemo(() => pairs.find((p) => `${p.subjectId}|${p.classId}` === pairKey) ?? null, [pairs, pairKey]);
  const finalCategory = useMemo(() => categories.find((c) => /итогов/i.test(c.name)) ?? null, [categories]);
  const defaultAsgCategory = useMemo(
    () => categories.find((c) => /классн|самостоятельн/i.test(c.name)) ?? categories[0] ?? null,
    [categories],
  );

  const loadGrid = useCallback(async () => {
    if (!selected || !periodId) return;
    setGridLoading(true);
    try {
      const q = `classId=${selected.classId}&subjectId=${selected.subjectId}&periodId=${periodId}`;
      const [sRes, gRes, aRes, nRes] = await Promise.all([
        fetch(`/api/v1/students?classId=${selected.classId}`),
        fetch(`/api/v1/grading?${q}`),
        fetch(`/api/v1/assignments?${q}`),
        fetch(`/api/v1/incidents-summary?classId=${selected.classId}`),
      ]);
      const [s, g, a, n] = await Promise.all([sRes.json(), gRes.json(), aRes.json(), nRes.json()]);
      if (s.success) setStudents([...s.data].sort((x: Student, y: Student) => `${x.lastName} ${x.firstName}`.localeCompare(`${y.lastName} ${y.firstName}`, 'ru')));
      if (g.success) setGrades(g.data);
      if (a.success) setAssignments(a.data);
      if (n.success) setNoteCounts(n.data);
    } finally {
      setGridLoading(false);
    }
  }, [selected, periodId]);

  useEffect(() => { if (selected && periodId) loadGrid(); }, [selected, periodId, loadGrid]);

  const reloadGrades = useCallback(async () => {
    if (!selected || !periodId) return;
    const g = await (await fetch(`/api/v1/grading?classId=${selected.classId}&subjectId=${selected.subjectId}&periodId=${periodId}`)).json();
    if (g.success) setGrades(g.data);
  }, [selected, periodId]);

  // оценка по (студент, назначение); прочие — без assignmentId и не итоговые
  const byCell = useMemo(() => {
    const map: Record<string, Grade> = {};
    for (const gr of grades) if (gr.assignmentId) map[`${gr.studentId}|${gr.assignmentId}`] = gr;
    return map;
  }, [grades]);

  const otherByStudent = useMemo(() => {
    const map: Record<string, Grade[]> = {};
    for (const gr of grades) {
      if (gr.assignmentId) continue;
      if (finalCategory && gr.category.id === finalCategory.id) continue;
      (map[gr.studentId] ??= []).push(gr);
    }
    return map;
  }, [grades, finalCategory]);

  const finalByStudent = useMemo(() => {
    const map: Record<string, Grade> = {};
    if (!finalCategory) return map;
    for (const gr of grades) if (!gr.assignmentId && gr.category.id === finalCategory.id) map[gr.studentId] = gr;
    return map;
  }, [grades, finalCategory]);

  /**
   * Среднее число (%) — только по назначениям (очки).
   * Вычисленная (5-балльная) — из процентов назначений, либо fallback из прочих
   * оценок (с учётом шкалы: старые 0–100 делим на 20).
   */
  const { percentByStudent, fiveByStudent } = useMemo(() => {
    const percent: Record<string, number> = {};
    const five: Record<string, number> = {};
    for (const st of students) {
      let got = 0;
      let max = 0;
      for (const a of assignments) {
        const gr = byCell[`${st.id}|${a.id}`];
        if (gr) { got += gr.value; max += a.maxPoints; }
      }
      if (max > 0) {
        const pct = Math.round((got / max) * 1000) / 10;
        percent[st.id] = pct;
        five[st.id] = computeFive(pct);
        continue;
      }
      const others = otherByStudent[st.id] ?? [];
      if (others.length) {
        let sum = 0;
        let w = 0;
        for (const gr of others) { sum += gradeToFive(gr) * gr.category.weight; w += gr.category.weight; }
        if (w) {
          const avg = sum / w;
          five[st.id] = Math.max(2, Math.min(5, Math.round(avg)));
        }
      }
    }
    return { percentByStudent: percent, fiveByStudent: five };
  }, [students, assignments, byCell, otherByStudent]);

  // ── Ввод балла в ячейку ──
  const startCell = (studentId: string, assignmentId: string) => {
    setEditCell({ studentId, assignmentId });
    setCellValue('');
  };

  const saveCell = async (moveNext = false) => {
    if (!editCell || cellValue === '' || !selected || !teacherId || !periodId) return;
    const asg = assignments.find((a) => a.id === editCell.assignmentId);
    if (!asg) return;
    setCellSaving(true);
    try {
      const res = await fetch('/api/v1/grading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: editCell.studentId,
          subjectId: selected.subjectId,
          categoryId: asg.categoryId || defaultAsgCategory?.id,
          teacherId,
          periodId,
          value: Number(cellValue),
          scale: 'HUNDRED',
          date: asg.date,
          assignmentId: asg.id,
        }),
      });
      const json = await res.json();
      if (json.success) {
        await reloadGrades();
        if (moveNext) {
          const idx = students.findIndex((s) => s.id === editCell.studentId);
          const next = students[idx + 1];
          if (next && !byCell[`${next.id}|${asg.id}`]) {
            setEditCell({ studentId: next.id, assignmentId: asg.id });
            setCellValue('');
            return;
          }
        }
        setEditCell(null);
      } else {
        toastError(json.error?.message ?? 'Не удалось сохранить балл');
      }
    } catch {
      toastError('Сеть недоступна — балл не сохранён');
    } finally {
      setCellSaving(false);
    }
  };

  // ── Назначения: создать/редактировать/удалить ──
  const openAsgCreate = () => {
    setAsgForm({ title: '', shortName: '', categoryId: defaultAsgCategory?.id ?? null, maxPoints: 100, date: todayISO() });
    setAsgModal({ mode: 'create' });
  };
  const openAsgEdit = (asg: Assignment) => {
    setAsgForm({
      title: asg.title,
      shortName: asg.shortName ?? '',
      categoryId: asg.categoryId ?? defaultAsgCategory?.id ?? null,
      maxPoints: asg.maxPoints,
      date: asg.date.slice(0, 10),
    });
    setAsgModal({ mode: 'edit', asg });
  };

  const saveAsg = async () => {
    if (!asgForm.title.trim() || !selected || !teacherId || !periodId) return;
    setAsgSaving(true);
    try {
      let res: Response;
      if (asgModal?.mode === 'edit' && asgModal.asg) {
        res = await fetch(`/api/v1/assignments/${asgModal.asg.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: asgForm.title.trim(),
            shortName: asgForm.shortName.trim() || null,
            categoryId: asgForm.categoryId,
            maxPoints: asgForm.maxPoints,
            date: new Date(asgForm.date),
          }),
        });
      } else {
        res = await fetch('/api/v1/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: asgForm.title.trim(),
            shortName: asgForm.shortName.trim() || undefined,
            classId: selected.classId,
            subjectId: selected.subjectId,
            teacherId,
            periodId,
            categoryId: asgForm.categoryId ?? undefined,
            maxPoints: asgForm.maxPoints,
            date: asgForm.date,
          }),
        });
      }
      const json = await res.json();
      if (!json.success) {
        toastError(json.error?.message ?? 'Не удалось сохранить назначение');
        return;
      }
      setAsgModal(null);
      await loadGrid();
    } catch {
      toastError('Сеть недоступна — назначение не сохранено');
    } finally {
      setAsgSaving(false);
    }
  };

  const deleteAsg = async (asg: Assignment) => {
    if (!confirm(`Удалить назначение «${asg.title}»? Оценки останутся в «Прочих».`)) return;
    try {
      const res = await fetch(`/api/v1/assignments/${asg.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) toastError(json.error?.message ?? 'Не удалось удалить назначение');
    } catch {
      toastError('Сеть недоступна — назначение не удалено');
    }
    await loadGrid();
  };

  // ── Итоговые ──
  const openFinals = () => {
    const drafts: Record<string, number> = {};
    for (const st of students) {
      if (finalByStudent[st.id]) continue;
      const five = fiveByStudent[st.id];
      if (five !== undefined) drafts[st.id] = five;
    }
    setFinalDrafts(drafts);
    setFinalsOpen(true);
  };

  const saveFinals = async () => {
    if (!selected || !teacherId || !periodId || !finalCategory) return;
    setFinalsSaving(true);
    try {
      let failed = 0;
      for (const [studentId, value] of Object.entries(finalDrafts)) {
        const res = await fetch('/api/v1/grading', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId, subjectId: selected.subjectId, categoryId: finalCategory.id,
            teacherId, periodId, value, scale: 'FIVE', date: todayISO(),
          }),
        });
        const json = await res.json().catch(() => ({ success: false }));
        if (!json.success) failed += 1;
      }
      if (failed > 0) toastError(`Не сохранилось итоговых: ${failed}`);
      setFinalsOpen(false);
      await reloadGrades();
    } catch {
      toastError('Сеть недоступна — итоговые не сохранены');
    } finally {
      setFinalsSaving(false);
    }
  };

  if (loading) return <Group justify="center" p="xl"><Loader /></Group>;

  const pairOptions = pairs.map((p) => ({ value: `${p.subjectId}|${p.classId}`, label: `${p.className} · ${p.subjectName}` }));
  const periodOptions = periods.map((p) => ({ value: p.id, label: p.name }));
  const catOptions = categories.map((c) => ({ value: c.id, label: `${c.name} ×${c.weight}` }));

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Group gap="xs">
          <IconBook2 size={26} color="var(--mantine-color-blue-6)" />
          <div>
            <Title order={2}>Журнал</Title>
            <Text c="dimmed" size="sm">Назначения — колонки. Клик по пустой клетке — поставить балл.</Text>
          </div>
        </Group>
        <Group gap="xs">
          <Button component={Link} href="/journal/attendance" variant="light" leftSection={<IconCalendarCheck size={16} />}>
            Посещаемость
          </Button>
          {selected && (
            <Button variant="light" color="gray" leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>
              Печать
            </Button>
          )}
          <Button component={Link} href="/journal/classic" variant="subtle" size="xs" c="dimmed">
            классический вид
          </Button>
        </Group>
      </Group>

      <Paper withBorder p="md" radius="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <Select label="Класс и предмет" data={pairOptions} value={pairKey} onChange={setPairKey} searchable w={260} placeholder="Выберите" />
          <Select label="Период" data={periodOptions} value={periodId} onChange={setPeriodId} w={150} />
          {selected && (
            <TextInput
              label="Ученик"
              placeholder="Поиск по имени"
              leftSection={<IconSearch size={14} />}
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.currentTarget.value)}
              w={180}
            />
          )}
          {selected && teacherId && (
            <>
              <Button leftSection={<IconPlus size={16} />} onClick={openAsgCreate}>Новое назначение</Button>
              {finalCategory && (
                <Button variant="light" color="teal" leftSection={<IconCheck size={16} />} onClick={openFinals}>
                  Выставить итоговые
                </Button>
              )}
            </>
          )}
        </Group>
      </Paper>

      {!selected ? (
        <Text c="dimmed" ta="center" py="lg">Выберите класс и предмет, чтобы открыть журнал.</Text>
      ) : !teacherId ? (
        <Text c="dimmed" ta="center" py="lg">Выставление оценок доступно учителю (нет привязки к преподавателю).</Text>
      ) : gridLoading ? (
        <Group justify="center" p="md"><Loader size="sm" /></Group>
      ) : (
        <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
          <ScrollArea>
            <Table highlightOnHover style={{ minWidth: 760 }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ color: SEC, fontSize: 12, minWidth: 190, position: 'sticky', left: 0, background: 'white', zIndex: 2 }}>
                    Ученик
                  </Table.Th>
                  {assignments.map((a) => (
                    <Table.Th key={a.id} style={{ fontSize: 12, minWidth: 86, textAlign: 'center' }}>
                      <Group gap={2} justify="center" wrap="nowrap">
                        <Tooltip label={`${a.title} · из ${a.maxPoints} очков`}>
                          <div>
                            <Text size="xs" fw={700} lh={1.1}>{a.shortName || a.title.slice(0, 8)}</Text>
                            <Text size="xs" c={SEC} lh={1.1}>{fmtDM(a.date)} · {a.maxPoints}</Text>
                          </div>
                        </Tooltip>
                        <Menu shadow="md" position="bottom-end">
                          <Menu.Target>
                            <ActionIcon size="xs" variant="subtle" color="gray"><IconDots size={12} /></ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<IconPencil size={13} />} onClick={() => openAsgEdit(a)}>Изменить</Menu.Item>
                            <Menu.Item leftSection={<IconTrash size={13} />} color="red" onClick={() => deleteAsg(a)}>Удалить</Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Th>
                  ))}
                  <Table.Th style={{ color: SEC, fontSize: 12, minWidth: 90 }}>Прочие</Table.Th>
                  <Table.Th style={{ color: '#1971c2', fontSize: 12, width: 78, textAlign: 'center', background: '#e7f5ff' }}>Среднее число</Table.Th>
                  <Table.Th style={{ color: '#e8590c', fontSize: 12, width: 92, textAlign: 'center', background: '#fff4e6' }}>Вычисленная</Table.Th>
                  <Table.Th style={{ color: SEC, fontSize: 12, width: 92, textAlign: 'center' }}>Итоговая</Table.Th>
                  <Table.Th style={{ color: SEC, fontSize: 12, width: 84, textAlign: 'center' }}>Заметки</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {students.filter((st) => !studentQuery.trim() || `${st.lastName} ${st.firstName}`.toLowerCase().includes(studentQuery.trim().toLowerCase())).map((st) => {
                  const pct = percentByStudent[st.id];
                  const five = fiveByStudent[st.id];
                  const fin = finalByStudent[st.id];
                  const notes = noteCounts[st.id] ?? 0;
                  return (
                    <Table.Tr key={st.id}>
                      <Table.Td style={{ position: 'sticky', left: 0, background: 'white', zIndex: 1 }}>
                        <Group gap={8} wrap="nowrap">
                          <Avatar size={26} radius="xl" src={st.photo || undefined} color="blue">
                            {st.lastName[0]}{st.firstName[0]}
                          </Avatar>
                          <Text size="sm" lineClamp={1}>{st.lastName} {st.firstName}</Text>
                        </Group>
                      </Table.Td>

                      {assignments.map((a) => {
                        const gr = byCell[`${st.id}|${a.id}`];
                        const isEditing = editCell?.studentId === st.id && editCell?.assignmentId === a.id;
                        return (
                          <Table.Td key={a.id} style={{ textAlign: 'center', cursor: gr ? undefined : 'pointer' }}
                            onClick={() => { if (!gr && !isEditing) startCell(st.id, a.id); }}>
                            {gr ? (
                              <EditableGradeBadge grade={gr} canDelete={canDelete} onChanged={reloadGrades} />
                            ) : isEditing ? (
                              <NumberInput
                                size="xs" w={64} min={0} max={a.maxPoints} hideControls autoFocus
                                placeholder={`0–${a.maxPoints}`}
                                value={cellValue}
                                onChange={(v) => setCellValue(v as number)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveCell(true);
                                  if (e.key === 'Escape') setEditCell(null);
                                }}
                                onBlur={() => { if (!cellSaving && cellValue === '') setEditCell(null); }}
                                rightSection={cellSaving ? <Loader size={12} /> : undefined}
                              />
                            ) : (
                              <Text size="sm" c="#ced4da">·</Text>
                            )}
                          </Table.Td>
                        );
                      })}

                      <Table.Td>
                        <Group gap={4}>
                          {(otherByStudent[st.id] ?? []).slice(0, 4).map((gr) => (
                            <EditableGradeBadge key={gr.id} grade={gr} canDelete={canDelete} onChanged={reloadGrades} />
                          ))}
                          {!(otherByStudent[st.id]?.length) && <Text size="xs" c={SEC}>—</Text>}
                        </Group>
                      </Table.Td>

                      <Table.Td style={{ textAlign: 'center', background: '#f4faff' }}>
                        <Text size="sm" fw={700} c={pct !== undefined ? '#1971c2' : SEC}>
                          {pct !== undefined ? pct : '—'}
                        </Text>
                      </Table.Td>

                      <Table.Td style={{ textAlign: 'center', background: '#fff9f2' }}>
                        {five !== undefined ? (
                          <Tooltip label="Примерная оценка — видна ученику как ориентир">
                            <Badge color={FIVE_COLOR[five]} variant="light" size="lg" radius="sm">
                              {five}
                            </Badge>
                          </Tooltip>
                        ) : (
                          <Text size="xs" c={SEC}>—</Text>
                        )}
                      </Table.Td>

                      <Table.Td style={{ textAlign: 'center' }}>
                        {fin ? (
                          <Tooltip label={FINAL_STATUS[fin.status ?? 'published']?.label ?? ''}>
                            <Badge color={FINAL_STATUS[fin.status ?? 'published']?.color ?? 'green'} size="lg" radius="sm">
                              {fin.value}
                            </Badge>
                          </Tooltip>
                        ) : five !== undefined && finalCategory ? (
                          <Tooltip label="Зафиксировать итоговую (уйдёт на модерацию завучу)">
                            <ActionIcon variant="light" color="teal" size="sm"
                              onClick={() => { setFinalDrafts({ [st.id]: five }); setFinalsOpen(true); }}>
                              <IconCheck size={14} />
                            </ActionIcon>
                          </Tooltip>
                        ) : (
                          <Text size="xs" c={SEC}>—</Text>
                        )}
                      </Table.Td>

                      <Table.Td style={{ textAlign: 'center' }}>
                        <Group gap={4} justify="center" wrap="nowrap">
                          {notes > 0 && (
                            <Tooltip label="История заметок">
                              <Badge size="sm" variant="light" color="orange" radius="sm" style={{ cursor: 'pointer' }}
                                leftSection={<IconHistory size={10} />}
                                onClick={() => setNotesViewFor(st)}>
                                {notes}
                              </Badge>
                            </Tooltip>
                          )}
                          <Tooltip label="Новая заметка">
                            <ActionIcon size="sm" variant="subtle" onClick={() => setNoteFor(st)}>
                              <IconPlus size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          <Text size="xs" c={SEC} p="xs">
            Балл — очки назначения. Среднее число — % набранных очков. Вычисленная — примерная пятибалльная. Итоговая идёт на модерацию завучу.
          </Text>
        </Paper>
      )}

      {/* Модал назначения */}
      <Modal opened={!!asgModal} onClose={() => setAsgModal(null)}
        title={asgModal?.mode === 'edit' ? 'Изменить назначение' : 'Новое назначение / экзамен'} centered>
        <Stack gap="sm">
          <TextInput label="Название" required placeholder="Классная работа" value={asgForm.title}
            onChange={(e) => setAsgForm({ ...asgForm, title: e.currentTarget.value })} />
          <Group grow>
            <TextInput label="Краткое имя" placeholder="КР1" value={asgForm.shortName}
              onChange={(e) => setAsgForm({ ...asgForm, shortName: e.currentTarget.value })} />
            <NumberInput label="Кол-во очков" min={1} max={100} value={asgForm.maxPoints}
              onChange={(v) => setAsgForm({ ...asgForm, maxPoints: Number(v) || 100 })} />
          </Group>
          <Select label="Тип работы (вес)" data={catOptions} value={asgForm.categoryId} searchable
            onChange={(v) => setAsgForm({ ...asgForm, categoryId: v })} />
          <TextInput label="Дата назначения" type="date" value={asgForm.date}
            onChange={(e) => setAsgForm({ ...asgForm, date: e.currentTarget.value })} />
          <Button onClick={saveAsg} loading={asgSaving} disabled={!asgForm.title.trim()}>
            Сохранить
          </Button>
        </Stack>
      </Modal>

      {/* Модал итоговых */}
      <Modal opened={finalsOpen} onClose={() => setFinalsOpen(false)} title="Итоговые оценки" centered>
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Предзаполнено из вычисленной. После сохранения оценки уйдут на модерацию завучу.
          </Text>
          {Object.keys(finalDrafts).length === 0 ? (
            <Text c="dimmed" ta="center" py="md">Все итоговые уже выставлены (или нет данных для расчёта).</Text>
          ) : (
            students.filter((st) => finalDrafts[st.id] !== undefined).map((st) => (
              <Group key={st.id} justify="space-between">
                <Text size="sm">{st.lastName} {st.firstName}</Text>
                <NumberInput size="xs" w={70} min={2} max={5} value={finalDrafts[st.id]}
                  onChange={(v) => setFinalDrafts((d) => ({ ...d, [st.id]: Number(v) || 2 }))} />
              </Group>
            ))
          )}
          <Button onClick={saveFinals} loading={finalsSaving} disabled={Object.keys(finalDrafts).length === 0} mt="xs">
            Сохранить и отправить на модерацию
          </Button>
        </Stack>
      </Modal>

      <NoteTypeModal
        opened={!!noteFor}
        onClose={() => setNoteFor(null)}
        studentId={noteFor?.id ?? null}
        studentName={noteFor ? `${noteFor.lastName} ${noteFor.firstName}` : undefined}
        onSaved={() => {
          setNoteCounts((c) => ({ ...c, [noteFor!.id]: (c[noteFor!.id] ?? 0) + 1 }));
          setNotesRefresh((k) => k + 1);
        }}
      />
      <NotesDrawer
        studentId={notesViewFor?.id ?? null}
        studentName={notesViewFor ? `${notesViewFor.lastName} ${notesViewFor.firstName}` : undefined}
        onClose={() => setNotesViewFor(null)}
        refreshKey={notesRefresh}
      />
    </Stack>
  );
}

export default function JournalPage() {
  return (
    <RoleGate roles={['teacher', 'curator', 'zavuch', 'super_admin', 'analyst']}>
      <Journal />
    </RoleGate>
  );
}
