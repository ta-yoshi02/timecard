'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, Group, Stack, Table, Text, Title } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import dayjs from 'dayjs';
import Link from 'next/link';
import StatusBadges from '../components/StatusBadges';
import { getLatestDatasetDate, summarizeEmployees } from '@/lib/attendance';
import { AttendanceRecord, Employee } from '@/lib/types';
import { useAuth, useRequireRole } from '../components/AuthProvider';

const formatHoursToHM = (hours: number) => {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}時間${m}分`;
};

const formatCurrency = (value?: number) => {
  if (typeof value !== 'number') return '-';
  return `${value.toLocaleString()}円`;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  useRequireRole('ADMIN');

  useEffect(() => {
    if (authLoading || user?.role !== 'ADMIN') return;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/attendance');
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        setEmployees(data.employees);
        setRecords(data.records);
        const latest = getLatestDatasetDate(data.records);
        if (latest) {
          setSelectedMonth((prev) => prev ?? dayjs(latest).startOf('month').toDate());
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'データ取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [authLoading, user]);

  const latest = useMemo(() => getLatestDatasetDate(records) ?? null, [records]);

  const startDate = useMemo(
    () => (latest ? dayjs(latest).subtract(6, 'day').toDate() : null),
    [latest],
  );

  const monthlyStart = useMemo(() => {
    const base = selectedMonth ?? latest;
    return base ? dayjs(base).startOf('month').toDate() : null;
  }, [selectedMonth, latest]);

  const monthlyEnd = useMemo(
    () => (monthlyStart ? dayjs(monthlyStart).endOf('month').toDate() : null),
    [monthlyStart],
  );

  const summaries = useMemo(() => {
    return summarizeEmployees(
      employees,
      records,
      startDate,
      latest ?? undefined,
      monthlyStart && monthlyEnd
        ? { start: monthlyStart, end: monthlyEnd }
        : undefined,
    );
  }, [employees, records, startDate, latest, monthlyStart, monthlyEnd]);

  const monthLabel = monthlyStart ? dayjs(monthlyStart).format('YYYY年M月') : '未選択';
  const monthRangeText =
    monthlyStart && monthlyEnd
      ? `${dayjs(monthlyStart).format('M/D')} 〜 ${dayjs(monthlyEnd).format('M/D')}`
      : '範囲なし';

  return (
    <Stack gap="md">
      <Card shadow="xs" padding="md" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <div>
            <Title order={2}>スタッフ一覧</Title>
            <Text c="dimmed">
              直近7日間の状況サマリー（終了日: {latest ? dayjs(latest).format('M/D') : 'データなし'}）
            </Text>
          </div>
        </Group>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>スタッフ</Table.Th>
              <Table.Th>役割</Table.Th>
              <Table.Th>勤務日数</Table.Th>
              <Table.Th>合計時間</Table.Th>
              <Table.Th>概算給与(7日)</Table.Th>
              <Table.Th>打刻異常</Table.Th>
              <Table.Th>残業</Table.Th>
              <Table.Th>ステータス</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {summaries.map((summary) => (
              <Table.Tr key={summary.employee.id}>
                <Table.Td>
                  <Link href={`/employees/${summary.employee.id}`}>
                    <Text fw={600}>{summary.employee.name}</Text>
                  </Link>
                </Table.Td>
                <Table.Td>{summary.employee.jobRole || summary.employee.role}</Table.Td>
                <Table.Td>{summary.records.length}日</Table.Td>
                <Table.Td>{formatHoursToHM(summary.totalHours)}</Table.Td>
                <Table.Td>{formatCurrency(summary.estimatedPay)}</Table.Td>
                <Table.Td>{summary.missingCount} 件</Table.Td>
                <Table.Td>{summary.overworkCount} 件</Table.Td>
                <Table.Td>
                  <StatusBadges issues={summary.issues} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Card shadow="xs" padding="md" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <div>
            <Title order={3}>月次サマリー</Title>
            <Text c="dimmed">
              {monthLabel} の勤怠（{monthRangeText}）
            </Text>
          </div>
          <MonthPickerInput
            label="対象月"
            placeholder="月を選択"
            value={monthlyStart}
            onChange={(value) => setSelectedMonth(value ? dayjs(value as Date | string).toDate() : null)}
            valueFormat="YYYY年M月"
            maxDate={latest ?? undefined}
            clearable={false}
          />
        </Group>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>スタッフ</Table.Th>
              <Table.Th>役割</Table.Th>
              <Table.Th>勤務日数(選択月)</Table.Th>
              <Table.Th>合計時間(選択月)</Table.Th>
              <Table.Th>概算給与(選択月)</Table.Th>
              <Table.Th>打刻異常(選択月)</Table.Th>
              <Table.Th>残業(選択月)</Table.Th>
              <Table.Th>ステータス(選択月)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {summaries.map((summary) => (
              <Table.Tr key={`${summary.employee.id}-monthly`}>
                <Table.Td>
                  <Link href={`/employees/${summary.employee.id}`}>
                    <Text fw={600}>{summary.employee.name}</Text>
                  </Link>
                </Table.Td>
                <Table.Td>{summary.employee.jobRole || summary.employee.role}</Table.Td>
                <Table.Td>{summary.monthly.records.length}日</Table.Td>
                <Table.Td>{formatHoursToHM(summary.monthly.totalHours)}</Table.Td>
                <Table.Td>{formatCurrency(summary.monthly.estimatedPay)}</Table.Td>
                <Table.Td>{summary.monthly.missingCount} 件</Table.Td>
                <Table.Td>{summary.monthly.overworkCount} 件</Table.Td>
                <Table.Td>
                  <StatusBadges issues={summary.monthly.issues} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      {error && (
        <Card padding="md" radius="md" withBorder>
          <Text c="red">{error}</Text>
        </Card>
      )}
      {loading && (
        <Card padding="md" radius="md" withBorder>
          <Text c="dimmed">読み込み中...</Text>
        </Card>
      )}
      {!loading && summaries.length === 0 && (
        <Card padding="md" radius="md" withBorder>
          <Text c="dimmed">表示できるスタッフがいません。</Text>
        </Card>
      )}
    </Stack>
  );
}
