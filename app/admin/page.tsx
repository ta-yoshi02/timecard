'use client';

import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Badge, Button, Card, Group, Menu, SegmentedControl, Stack, Table, Text, Title } from '@mantine/core';
import { DatePickerInput, DatesRangeValue } from '@mantine/dates';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { IconDots, IconEdit, IconKey, IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AttendanceIssue, detectIssues, getLatestDatasetDate, summarizeEmployees } from '@/lib/attendance';
import StatusBadges from '../components/StatusBadges';
import { AttendanceRecord, Employee } from '@/lib/types';
import { useAuth, useRequireRole } from '../components/AuthProvider';
import { EmployeeModal } from './components/EmployeeModal';
import { UserManagementModal } from './components/UserManagementModal';

type QuickFilter = 'all' | 'anomalies' | 'insufficientBreak';

const quickFilterOptions: { label: string; value: QuickFilter; description: string }[] = [
  { label: 'すべて', value: 'all', description: '全スタッフを表示' },
  { label: '打刻異常', value: 'anomalies', description: '選択日付内に打刻漏れがあるスタッフ' },
  { label: '休憩不足', value: 'insufficientBreak', description: '休憩時間が不足しているスタッフ' },
];

const anomalyIssues: AttendanceIssue[] = ['missingClockIn', 'missingClockOut'];

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

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [userModalEmployee, setUserModalEmployee] = useState<Employee | null>(null);

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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/attendance');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      // Fetch employees separately to get user data if needed, or rely on attendance API if it includes it
      // Actually attendance API might not include user data. Let's fetch employees explicitly.
      const empRes = await fetch('/api/employees');
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.employees);
      } else {
        setEmployees(data.employees);
      }

      setRecords(data.records);
      const latest = getLatestDatasetDate(data.records);
      if (latest && !dateRange[0]) {
        setDateRange([latest, latest]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || user?.role !== 'ADMIN') return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('本当に削除しますか？\nこの操作は取り消せません。関連する打刻データも全て削除されます。')) return;
    try {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('削除に失敗しました');
      notifications.show({ title: '成功', message: '従業員を削除しました', color: 'teal' });
      fetchData();
    } catch {
      notifications.show({ title: 'エラー', message: '削除に失敗しました', color: 'red' });
    }
  };

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
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModalOpen(true)}>
          従業員を追加
        </Button>
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
                description: opt.description,
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
              行をクリックすると詳細へ移動します。
            </Text>
          </div>
        </Group>
        <Table.ScrollContainer minWidth={800}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>スタッフ</Table.Th>
                <Table.Th>役割</Table.Th>
                <Table.Th>勤務日数</Table.Th>
                <Table.Th>合計時間</Table.Th>
                <Table.Th>概算給与</Table.Th>
                <Table.Th>最終打刻</Table.Th>
                <Table.Th>異常</Table.Th>
                <Table.Th>操作</Table.Th>
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
                    <Table.Td>{summary.employee.jobRole || summary.employee.role}</Table.Td>
                    <Table.Td>{summary.records.length}日</Table.Td>
                    <Table.Td>{formatHoursToHM(summary.totalHours)}</Table.Td>
                    <Table.Td>{formatCurrency(summary.estimatedPay)}</Table.Td>
                    <Table.Td>{issueLabel}</Table.Td>
                    <Table.Td>
                      <StatusBadges issues={statusIssues} />
                    </Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Menu shadow="md" width={200}>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray">
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconEdit size={14} />}
                            onClick={() => setEditingEmployee(summary.employee)}
                          >
                            編集
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconKey size={14} />}
                            onClick={() => setUserModalEmployee(summary.employee)}
                          >
                            アカウント管理
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => handleDeleteEmployee(summary.employee.id)}
                          >
                            削除
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {loading && (
          <Card padding="md" radius="md" withBorder mt="md">
            <Text c="dimmed">読み込み中...</Text>
          </Card>
        )}
        {!loading && filteredSummaries.length === 0 && (
          <Card padding="md" radius="md" withBorder mt="md">
            <Text c="dimmed">該当するデータがありません。</Text>
          </Card>
        )}
      </Card>

      <EmployeeModal
        opened={createModalOpen || !!editingEmployee}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingEmployee(null);
        }}
        onSuccess={fetchData}
        employee={editingEmployee}
      />

      <UserManagementModal
        opened={!!userModalEmployee}
        onClose={() => setUserModalEmployee(null)}
        onSuccess={fetchData}
        employee={userModalEmployee}
      />
    </Stack>
  );
}
