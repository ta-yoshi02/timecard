'use client';

import { AppShell, Burger, Button, Group, NavLink, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useMemo } from 'react';
import { useAuth } from './AuthProvider';

const adminNavItems = [
  {
    label: 'ダッシュボード',
    description: '日別勤怠の確認',
    href: '/admin',
  },
  {
    label: 'スタッフ一覧',
    description: '勤務傾向と詳細',
    href: '/employees',
  },
];

const employeeNavItems = [
  {
    label: 'マイ打刻',
    description: '自分の勤怠を確認・打刻',
    href: '/my',
  },
  {
    label: '勤怠サマリー',
    description: '月別の勤務集計',
    href: '/my/summary',
  },
];

const guestNavItems = [
  {
    label: 'ログイン',
    description: 'アカウントを選択',
    href: '/login',
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const pathname = usePathname();
  const router = useRouter();
  const { user, employee, logout, loading } = useAuth();

  const navItems = useMemo(() => {
    if (user?.role === 'ADMIN') return adminNavItems;
    if (user?.role === 'EMPLOYEE') return employeeNavItems;
    return guestNavItems;
  }, [user]);

  const activeHref = useMemo(() => {
    const matches = navItems
      .map((item) => item.href)
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`));
    if (matches.length === 0) return null;
    return matches.sort((a, b) => b.length - a.length)[0];
  }, [navItems, pathname]);

  const userLabel =
    user?.role === 'ADMIN'
      ? '管理者でログイン中'
      : user?.role === 'EMPLOYEE'
        ? `${employee?.name ?? '従業員'}でログイン中`
        : null;

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 240,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <div>
              <Text fw={700} size="md" visibleFrom="xs">勤怠チェックダッシュボード</Text>
              <Text fw={700} size="xs" hiddenFrom="xs">勤怠チェックダッシュボード</Text>
                </div>
              </Group>
                <Group gap="xs">
                  {userLabel && (
                <Text size="xs" c="dimmed">
                {userLabel}
              </Text>
                )}
            {!loading && user && (
                  <Button variant="light" size="xs" onClick={handleLogout}>
                  ログアウト
                </Button>
            )}
                  {!loading  && !user && (
                <Button variant="light" size="xs" component={Link} href="/login">
                      ログイン
                </Button>
              )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="xs">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              label={item.label}
              description={item.description}
              component={Link}
              href={item.href}
              active={activeHref === item.href}
              variant="light"
            />
          ))}
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
