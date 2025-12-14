'use client';

import { Container, Stack, Text, Title } from '@mantine/core';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { MonthlySummary } from '../components/MonthlySummary';
import { AttendanceRecord } from '@/lib/types';
import { useAuth, useRequireRole } from '../../components/AuthProvider';
import { Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { CreateAttendanceModal } from '../components/CreateAttendanceModal';

export default function MyMonthlySummaryPage() {
  const { user, employee, loading: authLoading } = useAuth();
  useRequireRole('EMPLOYEE');

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(
    dayjs().startOf('month').toDate(),
  );
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchMonthlyRecords = useCallback(
    async (month: Date) => {
      if (!user || user.role !== 'EMPLOYEE') return;
      setLoading(true);
      try {
        const start = dayjs(month).startOf('month').format('YYYY-MM-DD');
        const end = dayjs(month).endOf('month').format('YYYY-MM-DD');
        const res = await fetch(`/api/me/records?start=${start}&end=${end}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? `API error: ${res.status}`);
        }
        setRecords(data.records ?? []);
      } catch (e) {
        notifications.show({
          title: 'エラー',
          message: e instanceof Error ? e.message : '月次データの取得に失敗しました',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (!authLoading && user?.role === 'EMPLOYEE' && selectedMonth) {
      fetchMonthlyRecords(selectedMonth);
    }
  }, [authLoading, user, selectedMonth, fetchMonthlyRecords]);

  if (authLoading) {
    return (
      <Container size="lg" py="xl">
        <Text c="dimmed">読み込み中です...</Text>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="md">
        <div>
          <Title order={2}>月次勤怠サマリー</Title>
          <Text c="dimmed" size="sm">
            月を選んで自分の勤務時間・概算給与を確認できます
          </Text>
        </div>
        <MonthlySummary
          records={records}
          loading={loading}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          hourlyRate={employee?.hourlyRate}
          headerAction={
            <Button
              leftSection={<IconPlus size={16} />}
              variant="light"
              size="xs"
              onClick={() => setCreating(true)}
            >
              勤怠を追加
            </Button>
          }
        />
        <CreateAttendanceModal
          opened={creating}
          onClose={() => setCreating(false)}
          onSuccess={() => selectedMonth && fetchMonthlyRecords(selectedMonth)}
        />
      </Stack>
    </Container>
  );
}
