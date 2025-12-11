'use client';

import { Alert, Button, Card, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';

export default function LoginPage() {
  const form = useForm({
    initialValues: {
      loginId: '',
      password: '',
    },
  });
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    router.replace(user.role === 'ADMIN' ? '/admin' : '/my');
  }, [user, router]);

  const handleSubmit = async (values: { loginId: string; password: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'ログインに失敗しました');
        return;
      }
      await refresh();
      router.replace(data.role === 'ADMIN' ? '/admin' : '/my');
    } catch (e) {
      console.error(e);
      setError('通信エラーが発生しました。時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack gap="md" maw={420}>
      <Title order={2}>ログイン</Title>
      <Text c="dimmed" size="sm">
        管理者はダッシュボードへ、従業員はマイ打刻ページへ遷移します。
      </Text>
      <Card shadow="xs" padding="lg" radius="md" withBorder>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="sm">
            <TextInput
              label="ログインID"
              placeholder="employee001 など"
              required
              {...form.getInputProps('loginId')}
            />
            <PasswordInput
              label="パスワード"
              required
              {...form.getInputProps('password')}
            />
            {error && (
              <Alert color="red" title="ログインに失敗しました">
                {error}
              </Alert>
            )}
            <Button type="submit" loading={submitting}>
              ログイン
            </Button>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
