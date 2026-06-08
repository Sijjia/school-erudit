'use client';

import { useEffect, useState } from 'react';
import { Select } from '@mantine/core';
import { IconBuilding } from '@tabler/icons-react';
import { useRole } from '@/shared/hooks/useRole';

interface Branch { id: string; name: string }

function getCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Селектор текущего филиала (только для админа; остальные привязаны к своему). */
export function BranchSelector() {
  const { has } = useRole();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/branches').then((r) => r.json()).then((j) => setBranches(j.data ?? [])).catch(() => {});
    setValue(getCookie('bos_branch'));
  }, []);

  if (!has('super_admin', 'analyst')) return null;
  if (branches.length <= 1) return null;

  return (
    <Select
      size="xs" w={180} clearable
      leftSection={<IconBuilding size={14} />}
      placeholder="Все филиалы"
      data={branches.map((b) => ({ value: b.id, label: b.name }))}
      value={value}
      onChange={(v) => {
        document.cookie = `bos_branch=${v ?? ''}; path=/; max-age=${v ? 60 * 60 * 24 * 30 : 0}`;
        window.location.reload();
      }}
    />
  );
}
