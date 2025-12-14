'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, Group, SegmentedControl, Stack, Table, Text, Title } from '@mantine/core';
import { DatePickerInput, DatesRangeValue } from '@mantine/dates';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { AttendanceIssue, detectIssues, getLatestDatasetDate, summarizeEmployees } from '@/lib/attendance';
import StatusBadges from '../components/StatusBadges';
import { AttendanceRecord, Employee } from '@/lib/types';
import { useAuth, useRequireRole } from '../components/AuthProvider';

type QuickFilter = 'all' | 'anomalies' | 'insufficientBreak';

const quickFilterOptions: { label: string; value: QuickFilter; description: string }[] = [
  { label: 'すべて', value: 'all', description: '全スタッフを表示' },
  { label: '打刻異常', value: 'anomalies', description: '選択日付内に打刻漏れがあるスタッフ' },
  { label: '休憩不足', value: 'insufficientBreak', description: '休憩時間が不足しているスタッフ' },
];

const anomalyIssues: AttendanceIssue[] = ['missingClockIn', 'missingClockOut'];
const overworkIssues: AttendanceIssue[] = ['overwork', 'insufficientBreak'];

const formatClockRange = (recordIssues: AttendanceIssue[], dateLabel: string) => {
  if (recordIssues.includes('missingClockIn') && recordIssues.includes('missingClockOut')) {
    return `${dateLabel} 打刻なし`;
  }
  return dateLabel;
};

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

export default function DashboardPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [dateRange, setDateRange] = useState<DatesRangeValue>([null, null]);
  const [filter, setFilter] = useState<QuickFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useRequireRole('ADMIN');

  const latestAvailable = useMemo(() => getLatestDatasetDate(records), [records]);

  const [startDate, endDate] = useMemo<[Date | null, Date | null]>(() => {
    const [start, end] = dateRange;
    const fallback = latestAvailable ?? null;
    const resolvedStart = start ? dayjs(start).toDate() : fallback;
    const resolvedEnd = end ? dayjs(end).toDate() : resolvedStart;
    return [resolvedStart, resolvedEnd];
  }, [dateRange, latestAvailable]);

  const summaries = useMemo(() => {
    return summarizeEmployees(employees, records, startDate, endDate);
  }, [startDate, endDate, employees, records]);

  const filteredSummaries = useMemo(() => {
    return summaries.filter((summary) => {
      const hasAnomaly = summary.records.some((record) =>
        detectIssues(record).some((issue) => anomalyIssues.includes(issue)),
      );
      const hasInsufficientBreak = summary.records.some((record) =>
        detectIssues(record).includes('insufficientBreak'),
      );
      if (filter === 'anomalies') {
        return hasAnomaly;
      }
      if (filter === 'insufficientBreak') {
        return hasInsufficientBreak;
      }
      return true;
    });
  }, [summaries, filter]);

  const totalIssues = summaries.reduce(
    (acc, s) =>
      acc +
      s.records.reduce(
        (inner, record) =>
          inner +
          detectIssues(record).filter((issue) => issue !== 'overwork' && issue !== 'nightShift').length,
        0,
      ),
    0,
  );

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
          setDateRange([latest, latest]);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'データ取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [authLoading, user]);

  if (authLoading) {
    return (
      <Card shadow="xs" padding="md" radius="md" withBorder>
        <Text c="dimmed">権限を確認しています...</Text>
      </Card>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <Card shadow="xs" padding="md" radius="md" withBorder>
        <Text c="dimmed">管理者ページへリダイレクトします...</Text>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>日別勤怠ダッシュボード</Title>
          <Text c="dimmed">日付を選んで打刻状況と異常を確認</Text>
        </div>
      </Group>

      <Card shadow="xs" padding="md" radius="md" withBorder>
        <Stack gap="md">
          <Group align="flex-end" justify="space-between">
            <DatePickerInput
              type="range"
              label="確認したい日付（単日または範囲）"
              placeholder="日付を選択"
              valueFormat="YYYY-MM-DD"
              value={dateRange}
              onChange={setDateRange}
              maxDate={getLatestDatasetDate(records) ?? new Date()}
              allowSingleDateInRange
              w="100%"
            />
            <SegmentedControl
              value={filter}
              onChange={(value) => setFilter(value as QuickFilter)}
              data={quickFilterOptions.map((opt) => ({
                label: opt.label,
                value: opt.value,
              }))}
            />
          </Group>
          <Group gap="xs">
            <Badge color="green" variant="light">
              日付範囲のレコード: {summaries.reduce((acc, s) => acc + s.records.length, 0)}件
            </Badge>
            <Badge color={totalIssues > 0 ? 'red' : 'green'} variant="light">
              検知された異常: {totalIssues}件
            </Badge>
            {error && (
              <Badge color="red" variant="light">
                {error}
              </Badge>
            )}
          </Group>
        </Stack>
      </Card>

      <Card shadow="xs" padding="md" radius="md" withBorder>
        <Group justify="space-between" mb="sm">
          <div>
            <Text fw={600}>スタッフ別勤怠</Text>
            <Text size="sm" c="dimmed">
              行をクリックすると詳細へ移動します。概算給与は選択した日付範囲の累計です。
            </Text>
          </div>
        </Group>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>スタッフ</Table.Th>
              <Table.Th>役割</Table.Th>
              <Table.Th>勤務日数(選択範囲)</Table.Th>
              <Table.Th>合計時間(選択範囲)</Table.Th>
              <Table.Th>概算給与(選択範囲)</Table.Th>
              <Table.Th>最終打刻</Table.Th>
              <Table.Th>異常</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredSummaries.map((summary) => {
              const latest = summary.latestRecord;
              const latestIssues = latest ? detectIssues(latest) : [];
              const issueLabel = latest
                ? formatClockRange(
                  latestIssues,
                  `${latest.date} ${latest.clockIn ?? '--:--'} - ${latest.clockOut ?? '--:--'}`,
                )
                : 'データなし';

              const statusIssues = Array.from(
                new Set(
                  summary.records.flatMap((record) =>
                    detectIssues(record).filter((issue) => issue !== 'overwork' && issue !== 'nightShift'),
                  ),
                ),
              );

              return (
                <Table.Tr
                  key={summary.employee.id}
                  onClick={() => router.push(`/employees/${summary.employee.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <Table.Td>
                    <Group gap="xs">
                      <Text fw={600}>{summary.employee.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>{summary.employee.role}</Table.Td>
                  <Table.Td>{summary.records.length}日</Table.Td>
                  <Table.Td>{formatHoursToHM(summary.totalHours)}</Table.Td>
                  <Table.Td>{formatCurrency(summary.estimatedPay)}</Table.Td>
                  <Table.Td>{issueLabel}</Table.Td>
                  <Table.Td>
                    <StatusBadges issues={statusIssues} />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        {loading && (
          <Card padding="md" radius="md" withBorder mt="md">
            <Text c="dimmed">読み込み中...</Text>
          </Card>
        )}
        {!loading && filteredSummaries.length === 0 && (
          <Card padding="md" radius="md" withBorder mt="md">
            <Text c="dimmed">該当するデータがありません。日付やフィルタを変更してください。</Text>
          </Card>
        )}
      </Card>
    </Stack>
  );
}
