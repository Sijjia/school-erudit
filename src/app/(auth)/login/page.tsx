'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import {
  Box,
  Button,
  Divider,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconLock, IconUser } from '@tabler/icons-react';

/** Демо-аккаунты для быстрого входа (пароль у всех — erudit2025). */
const DEMO_PASSWORD = 'erudit2025';
const QUICK_ROLES: { label: string; login: string }[] = [
  { label: 'Админ', login: 'admin' },
  { label: 'Завуч', login: 'kozlova' },
  { label: 'Учитель', login: 'azhibaeva' },
  { label: 'Ученик', login: 'student1' },
  { label: 'Родитель', login: 'parent1' },
];

export default function LoginPage() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      login: '',
      password: '',
    },
    validate: {
      login: (value) => (value.length < 1 ? 'Введите логин' : null),
      password: (value) => (value.length < 1 ? 'Введите пароль' : null),
    },
  });

  // If already authenticated, redirect based on role
  if (status === 'authenticated') {
    const role = (session?.user as { role?: string })?.role;
    router.push(role === 'student' || role === 'parent' ? '/diary' : '/dashboard');
    return null;
  }

  async function doLogin(login: string, password: string) {
    setError(null);
    const result = await signIn('credentials', { login, password, redirect: false });
    if (result?.error) {
      setError('Неверный логин или пароль');
    } else if (result?.ok) {
      // After login, fetch session to determine role-based redirect
      const res = await fetch('/api/v1/me');
      const me = await res.json().catch(() => null);
      const role = me?.data?.role;
      router.push(role === 'student' || role === 'parent' ? '/diary' : '/dashboard');
    }
  }

  const handleSubmit = form.onSubmit(async (values) => {
    setLoading(true);
    try {
      await doLogin(values.login, values.password);
    } catch {
      setError('Произошла ошибка. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  });

  async function quickLogin(login: string) {
    setPending(login);
    try {
      await doLogin(login, DEMO_PASSWORD);
    } catch {
      setError('Произошла ошибка. Попробуйте позже.');
    } finally {
      setPending(null);
    }
  }

  // Show nothing while checking session
  if (status === 'loading') {
    return null;
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--mantine-color-body)',
      }}
    >
      <Box
        style={{
          width: 400,
          background: 'var(--mantine-color-default)',
          borderRadius: 8,
          border: '1px solid var(--mantine-color-default-border)',
          padding: 40,
        }}
      >
        <Stack align="center" gap={4} mb={32}>
          <Text fw={900} style={{ fontSize: 36, letterSpacing: 2, lineHeight: 1 }}>
            <span style={{ color: 'var(--mantine-color-text)' }}>ER</span>
            <span style={{ color: '#e91e8c' }}>U</span>
            <span style={{ color: 'var(--mantine-color-text)' }}>DITE</span>
          </Text>
          <Text size="sm" c="dimmed" mt={8}>
            Система управления школой
          </Text>
        </Stack>

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Логин"
              placeholder="Введите логин"
              leftSection={<IconUser size={16} />}
              size="sm"
              styles={{
                label: { color: 'var(--mantine-color-dimmed)', fontSize: 13, marginBottom: 4 },
                input: {
                  backgroundColor: 'var(--mantine-color-body)',
                  borderColor: 'var(--mantine-color-default-border)',
                  color: 'var(--mantine-color-text)',
                },
              }}
              {...form.getInputProps('login')}
            />

            <PasswordInput
              label="Пароль"
              placeholder="Введите пароль"
              leftSection={<IconLock size={16} />}
              size="sm"
              styles={{
                label: { color: 'var(--mantine-color-dimmed)', fontSize: 13, marginBottom: 4 },
                input: {
                  backgroundColor: 'var(--mantine-color-body)',
                  borderColor: 'var(--mantine-color-default-border)',
                  color: 'var(--mantine-color-text)',
                },
              }}
              {...form.getInputProps('password')}
            />

            {error && (
              <Text size="sm" c="red" ta="center">
                {error}
              </Text>
            )}

            <Button
              type="submit"
              fullWidth
              mt="sm"
              size="sm"
              color="eruditBlue"
              radius="sm"
              loading={loading}
              styles={{
                root: { fontWeight: 600 },
              }}
            >
              Войти
            </Button>
          </Stack>
        </form>

        <Divider
          label="Быстрый вход (демо)"
          labelPosition="center"
          my="md"
          styles={{ label: { color: 'var(--mantine-color-dimmed)', fontSize: 12 } }}
        />
        <Group gap="xs" justify="center">
          {QUICK_ROLES.map((r) => (
            <Button
              key={r.login}
              variant="light"
              color="eruditBlue"
              size="xs"
              radius="sm"
              loading={pending === r.login}
              disabled={loading || (pending !== null && pending !== r.login)}
              onClick={() => quickLogin(r.login)}
            >
              {r.label}
            </Button>
          ))}
        </Group>

        <Text size="xs" c="dimmed" ta="center" mt={24}>
          ERUDIT ERP v0.1.0
        </Text>
      </Box>
    </Box>
  );
}
