'use client';

import { Badge, Text } from '@mantine/core';
import { IconBooks } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';
import { ResourcePage } from '@/shared/components/ui/ResourcePage';
import { fmtDate } from '@/shared/components/ui/resource-helpers';

/**
 * База знаний школы: документы-инструкции, по которым ассистент ядра
 * отвечает «за менеджера» — режим работы, правила приёма, оплата и т.п.
 */

const CATEGORIES = [
  { value: 'режим', label: 'Режим работы' },
  { value: 'приём', label: 'Приём' },
  { value: 'оплата', label: 'Оплата' },
  { value: 'общее', label: 'Общее' },
];

const CAT_COLORS: Record<string, string> = {
  режим: 'blue',
  приём: 'violet',
  оплата: 'orange',
  общее: 'gray',
};

export default function KnowledgePage() {
  return (
    <RoleGate roles={['super_admin', 'analyst', 'zavuch', 'secretary']}>
      <ResourcePage
        title="База знаний"
        icon={<IconBooks size={22} color="#7c3aed" />}
        endpoint="/api/v1/knowledge"
        createLabel="Добавить документ"
        canDelete
        columns={[
          { key: 'title', label: 'Документ' },
          {
            key: 'category',
            label: 'Категория',
            render: (r) => (
              <Badge variant="light" color={CAT_COLORS[String(r.category)] ?? 'gray'} radius="sm">
                {CATEGORIES.find((c) => c.value === r.category)?.label ?? String(r.category ?? '—')}
              </Badge>
            ),
            width: 140,
          },
          {
            key: 'content',
            label: 'Содержание',
            render: (r) => (
              <Text size="sm" c="dimmed" lineClamp={2} maw={520}>
                {String(r.content ?? '')}
              </Text>
            ),
          },
          { key: 'updatedAt', label: 'Обновлён', render: (r) => fmtDate(r.updatedAt), width: 110 },
        ]}
        fields={[
          { name: 'title', label: 'Название', type: 'text', required: true, placeholder: 'Режим работы школы' },
          { name: 'category', label: 'Категория', type: 'select', options: CATEGORIES, defaultValue: 'общее' },
          {
            name: 'content',
            label: 'Текст документа',
            type: 'textarea',
            required: true,
            placeholder: 'Инструкция, правила, описание — ассистент будет отвечать по этому тексту',
          },
        ]}
      />
    </RoleGate>
  );
}
