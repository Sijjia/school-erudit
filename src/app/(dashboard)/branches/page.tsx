'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, Card, Group, Loader, Modal, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconBuilding, IconPlus, IconEdit } from '@tabler/icons-react';
import { RoleGate } from '@/shared/components/auth/RoleGate';

interface Req { name?: string; inn?: string; account?: string; address?: string }
interface Branch { id: string; name: string; address: string | null; requisites: Req | null; isActive: boolean }

function Branches() {
  const [list, setList] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Branch | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const j = await fetch('/api/v1/branches').then((r) => r.json()).catch(() => ({ data: [] }));
    setList(j.data ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Group gap="xs"><IconBuilding size={26} color="#1971c2" /><Title order={2}>Филиалы</Title></Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>Новый филиал</Button>
      </Group>
      <Text c="dimmed" size="sm">Реквизиты филиала (ИНН, р/с) подставляются в PDF-договоры.</Text>
      {loading ? <Group justify="center" p="xl"><Loader /></Group> : (
        <Stack gap="sm">
          {list.map((br) => (
            <Card key={br.id} withBorder radius="md">
              <Group justify="space-between">
                <div>
                  <Text fw={600}>{br.name}</Text>
                  <Text size="sm" c="dimmed">{br.requisites?.inn ? `ИНН ${br.requisites.inn}` : 'реквизиты не заданы'}{br.requisites?.account ? ` · р/с ${br.requisites.account}` : ''}</Text>
                </div>
                <Button size="xs" variant="light" leftSection={<IconEdit size={14} />} onClick={() => setEdit(br)}>Реквизиты</Button>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      {(edit || creating) && <BranchModal branch={edit} onClose={() => { setEdit(null); setCreating(false); }} onDone={() => { setEdit(null); setCreating(false); load(); }} />}
    </Stack>
  );
}

function BranchModal({ branch, onClose, onDone }: { branch: Branch | null; onClose: () => void; onDone: () => void }) {
  const r = branch?.requisites ?? {};
  const [name, setName] = useState(branch?.name ?? '');
  const [address, setAddress] = useState(branch?.address ?? r.address ?? '');
  const [inn, setInn] = useState(r.inn ?? '');
  const [account, setAccount] = useState(r.account ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const requisites = { name: name, inn, account, address };
    if (branch) {
      await fetch(`/api/v1/branches/${branch.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, address, requisites }) });
    } else {
      await fetch('/api/v1/branches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, address, requisites }) });
    }
    setSaving(false); onDone();
  }

  return (
    <Modal opened onClose={onClose} title={branch ? `Филиал: ${branch.name}` : 'Новый филиал'} centered>
      <Stack gap="sm">
        <TextInput label="Название" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput label="Адрес" value={address} onChange={(e) => setAddress(e.currentTarget.value)} />
        <TextInput label="ИНН" value={inn} onChange={(e) => setInn(e.currentTarget.value)} />
        <TextInput label="Расчётный счёт" value={account} onChange={(e) => setAccount(e.currentTarget.value)} />
        <Group justify="flex-end"><Button variant="subtle" color="gray" onClick={onClose}>Отмена</Button><Button onClick={save} loading={saving}>Сохранить</Button></Group>
      </Stack>
    </Modal>
  );
}

export default function BranchesPage() {
  return (
    <RoleGate roles={['super_admin', 'analyst']}>
      <Branches />
    </RoleGate>
  );
}
