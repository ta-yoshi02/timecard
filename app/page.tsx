'use client';

import { Card, Center, Loader, Stack, Text } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RootRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <Center h="100%">
      <Card padding="lg" radius="md" withBorder>
        <Stack gap="xs" align="center">
          <Loader size="sm" />
          <Text>ページ遷移中です…</Text>
          <Text c="dimmed" size="sm">
            ログインページへ移動しています。
          </Text>
        </Stack>
      </Card>
    </Center>
  );
}
