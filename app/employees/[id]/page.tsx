'use client';

import { Badge, Button, Card, Group, Table, Text, Title, Modal, Stack, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { MonthPickerInput, DateInput } from '@mantine/dates';
import { IconPlus } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useParams, useRouter } from 'next/navigation';
import StatusBadges from '../../components/StatusBadges';
import { useAuth, useRequireRole } from '../../components/AuthProvider';
import { notifications } from '@mantine/notifications';
import {
  AttendanceIssue,
  calculateDailyHours,
  detectIssues,
  filterRecordsByDateRange,
  getLatestDatasetDate,
  calculatePay,
} from '@/lib/attendance';
import { AttendanceRecord, Employee } from '@/lib/types';
import { useEffect, useMemo, useState } from 'react';

const formatHours = (hours: number | null) => {
  if (hours === null) return '-';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}時間${m}分`;
};

const formatTotalHours = (hours: number) => {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}時間${m}分`;
};

const formatCurrency = (value?: number) => {
  if (typeof value !== 'number') return '-';
  return `${value.toLocaleString()}円`;
};

const issuesToCount = (recordsIssues: AttendanceIssue[][]) => {
  return recordsIssues.reduce(
    (acc, issues) => {
      const hasOverwork = issues.includes('overwork');
      const missing =
        Number(issues.includes('missingClockIn')) +
        Number(issues.includes('missingClockOut'));
      return {
        overwork: acc.overwork + (hasOverwork ? 1 : 0),
        missing: acc.missing + missing,
      };
    },
    { overwork: 0, missing: 0 },
  );
};

const resolveId = (idParam: string | string[] | undefined): string | undefined => {
  if (!idParam) return undefined;
  return Array.isArray(idParam) ? idParam[0] : idParam;
};

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = resolveId(params?.id);
  const { user, loading: authLoading } = useAuth();
  useRequireRole('ADMIN');

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError('スタッフIDが不正です');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/employees/${id}/records`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setEmployee(data.employee);
        setAllRecords(data.records);
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
    if (!authLoading && user?.role === 'ADMIN') {
      fetchData();
    }
  }, [id, authLoading, user]);

  const editForm = useForm({
    initialValues: {
      clockIn: '',
      clockOut: '',
      breakStart: '',
      breakEnd: '',
      note: '',
    },
    validate: {
      clockIn: (value) => (value && !/^([0-9]|[1-4][0-9]):[0-5][0-9]$/.test(value) ? '無効な時間です (HH:mm)' : null),
      clockOut: (value) => (value && !/^([0-9]|[1-4][0-9]):[0-5][0-9]$/.test(value) ? '無効な時間です (HH:mm)' : null),
      breakStart: (value) => (value && !/^([0-9]|[1-4][0-9]):[0-5][0-9]$/.test(value) ? '無効な時間です (HH:mm)' : null),
      breakEnd: (value) => (value && !/^([0-9]|[1-4][0-9]):[0-5][0-9]$/.test(value) ? '無効な時間です (HH:mm)' : null),
    },
  });

  const createForm = useForm({
    initialValues: {
      date: null as Date | null,
      clockIn: '',
      clockOut: '',
      breakStart: '',
      breakEnd: '',
      note: '',
    },
    validate: {
      clockIn: (value) => (value && !/^([0-9]|[1-4][0-9]):[0-5][0-9]$/.test(value) ? '無効な時間です (HH:mm)' : null),
      clockOut: (value) => (value && !/^([0-9]|[1-4][0-9]):[0-5][0-9]$/.test(value) ? '無効な時間です (HH:mm)' : null),
      breakStart: (value) => (value && !/^([0-9]|[1-4][0-9]):[0-5][0-9]$/.test(value) ? '無効な時間です (HH:mm)' : null),
      breakEnd: (value) => (value && !/^([0-9]|[1-4][0-9]):[0-5][0-9]$/.test(value) ? '無効な時間です (HH:mm)' : null),
    },
  });

  useEffect(() => {
    if (!editingRecord) return;
    editForm.setValues({
      clockIn: editingRecord.clockIn ?? '',
      clockOut: editingRecord.clockOut ?? '',
      breakStart: editingRecord.breakStart ?? '',
      breakEnd: editingRecord.breakEnd ?? '',
      note: editingRecord.note ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingRecord]);

  const handleUpdate = async (values: typeof editForm.values) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          recordId: editingRecord?.id,
          clientTime: dayjs().toISOString(),
          ...values,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? '修正に失敗しました');
      }
      setEditingRecord(null);
      // Refresh data
      const refreshRes = await fetch(`/api/employees/${id}/records`);
      const refreshData = await refreshRes.json();
      setAllRecords(refreshData.records);
    } catch (e) {
      alert(e instanceof Error ? e.message : '修正に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async (values: typeof createForm.values) => {
    if (!values.date) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          employeeId: id,
          date: dayjs(values.date).format('YYYY-MM-DD'),
          clientTime: dayjs().toISOString(),
          clockIn: values.clockIn,
          clockOut: values.clockOut,
          breakStart: values.breakStart,
          breakEnd: values.breakEnd,
          note: values.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? '作成に失敗しました');
      }
      setCreating(false);
      createForm.reset();
      // Refresh data
      const refreshRes = await fetch(`/api/employees/${id}/records`);
      const refreshData = await refreshRes.json();
      setAllRecords(refreshData.records);
      notifications.show({
        title: '成功',
        message: '勤怠を追加しました',
        color: 'teal',
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : '作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const latestDate = useMemo(() => getLatestDatasetDate(allRecords), [allRecords]);

  const monthStart = useMemo(() => {
    const base = selectedMonth ?? latestDate;
    return base ? dayjs(base).startOf('month').toDate() : null;
  }, [selectedMonth, latestDate]);

  const monthEnd = useMemo(
    () => (monthStart ? dayjs(monthStart).endOf('month').toDate() : null),
    [monthStart],
  );

  const records = useMemo(
    () => filterRecordsByDateRange(allRecords, monthStart, monthEnd),
    [allRecords, monthStart, monthEnd],
  );

  const recordIssues = useMemo(() => records.map((record) => detectIssues(record)), [records]);
  const totalHours = useMemo(() => {
    return records.reduce((acc, record) => {
      const hours = calculateDailyHours(record);
      return acc + (hours ?? 0);
    }, 0);
  }, [records]);

  const monthly = useMemo(() => {
    if (!employee) {
      return { start: null, end: null, hours: 0, pay: 0, missing: 0, overwork: 0 };
    }
    const monthlyIssues = issuesToCount(records.map((record) => detectIssues(record)));
    const hours = records.reduce((acc, record) => {
      const h = calculateDailyHours(record);
      return acc + (h ?? 0);
    }, 0);
    const pay = records.reduce((acc, record) => {
      return acc + calculatePay(record, employee.hourlyRate).pay;
    }, 0);
    return {
      start: monthStart,
      end: monthEnd,
      hours,
      pay,
      missing: monthlyIssues.missing,
      overwork: monthlyIssues.overwork,
    };
  }, [employee, records, monthStart, monthEnd]);

  const monthLabel = monthStart ? dayjs(monthStart).format('YYYY年M月') : '未選択';
  const rangeLabel =
    monthStart && monthEnd
      ? `${dayjs(monthStart).format('M/D')} 〜 ${dayjs(monthEnd).format('M/D')}`
      : '範囲なし';

  if (loading) {
    return (
      <Card shadow="xs" padding="md" radius="md" withBorder>
        <Text c="dimmed">読み込み中...</Text>
      </Card>
    );
  }

  if (error || !employee) {
    return (
      <Card shadow="xs" padding="md" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={2}>スタッフが見つかりません</Title>
          <Badge color="red" variant="light">
            エラー
          </Badge>
        </Group>
        <Text mb="sm">{error ?? '指定されたスタッフIDのデータがありません。'}</Text>
        <Button variant="light" onClick={() => router.push('/employees')}>
          スタッフ一覧へ戻る
        </Button>
      </Card>
    );
  }

  return (
    <Card shadow="xs" padding="md" radius="md" withBorder>
      <Group justify="space-between" mb="md" align="flex-start">
        <div>
          <Title order={2}>{employee.name}</Title>
          <Text c="dimmed">
            {employee.role}・{monthLabel} の勤怠・時給 {formatCurrency(employee.hourlyRate)}（{rangeLabel}）
          </Text>
          <Group gap="xs" mt="xs">
            <Badge color="blue" variant="light">
              概算給与(選択月): {formatCurrency(Math.round(monthly.pay))}
            </Badge>
            <Badge color="green" variant="light">
              勤務時間(選択月): {formatTotalHours(monthly.hours)}
            </Badge>
            <Badge color="gray" variant="light">
              総勤務時間(選択月): {formatTotalHours(totalHours)}
            </Badge>
            <Badge color={monthly.missing > 0 ? 'red' : 'green'} variant="light">
              打刻異常(選択月): {monthly.missing} 件
            </Badge>
            <Badge color={monthly.overwork > 0 ? 'orange' : 'green'} variant="light">
              長時間勤務(選択月): {monthly.overwork} 件
            </Badge>
          </Group>
        </div>
        <MonthPickerInput
          label="表示月"
          placeholder="月を選択"
          value={selectedMonth ?? monthStart}
          onChange={(value) => setSelectedMonth(value ? dayjs(value as Date | string).toDate() : null)}
          valueFormat="YYYY年M月"
          maxDate={latestDate ?? undefined}
          clearable={false}
        />
      </Group>

      <Group justify="flex-end" mb="md">
        <Button
          leftSection={<IconPlus size={16} />}
          variant="light"
          size="xs"
          onClick={() => setCreating(true)}
        >
          勤怠を追加
        </Button>
      </Group>

      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>日付</Table.Th>
            <Table.Th>出勤</Table.Th>
            <Table.Th>退勤</Table.Th>
            <Table.Th>実働</Table.Th>
            <Table.Th>休憩</Table.Th>
            <Table.Th>日額(概算)</Table.Th>
            <Table.Th>メモ</Table.Th>
            <Table.Th>ステータス</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {records.map((record, index) => {
            const issues = recordIssues[index];
            const hours = calculateDailyHours(record);
            const dayPay =
              employee && hours
                ? calculatePay(record, employee.hourlyRate).pay
                : undefined;
            return (
              <Table.Tr
                key={record.id}
                onClick={() => setEditingRecord(record)}
                style={{ cursor: 'pointer' }}
              >
                <Table.Td>
                  <Text fw={600}>{dayjs(record.date).format('M/D')}</Text>
                  {record.shiftStart && record.shiftEnd && (
                    <Text size="xs" c="dimmed">
                      {record.shiftStart} - {record.shiftEnd}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {dayjs(record.date).format('ddd')}
                  </Text>
                </Table.Td>
                <Table.Td>{record.clockIn ?? '-'}</Table.Td>
                <Table.Td>{record.clockOut ?? '-'}</Table.Td>
                <Table.Td>{formatHours(hours)}</Table.Td>
                <Table.Td>
                  {typeof record.breakMinutes === 'number'
                    ? `${record.breakMinutes}分`
                    : '-'}
                </Table.Td>
                <Table.Td>{formatCurrency(dayPay)}</Table.Td>
                <Table.Td>{record.note || '-'}</Table.Td>
                <Table.Td>
                  <StatusBadges issues={issues} />
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      {records.length === 0 && (
        <Card padding="md" radius="md" withBorder mt="md">
          <Text c="dimmed">
            {monthLabel} に表示できる打刻データがありません。
          </Text>
        </Card>
      )}
      <Modal opened={!!editingRecord} onClose={() => setEditingRecord(null)} title={`${editingRecord ? dayjs(editingRecord.date).format('M/D') : ''} の打刻を修正`} centered>
        <form onSubmit={editForm.onSubmit(handleUpdate)}>
          <Stack gap="sm">
            <TextInput label="出勤" placeholder="HH:mm" {...editForm.getInputProps('clockIn')} />
            <Group grow>
              <TextInput label="休憩開始" placeholder="HH:mm" {...editForm.getInputProps('breakStart')} />
              <TextInput label="休憩終了" placeholder="HH:mm" {...editForm.getInputProps('breakEnd')} />
            </Group>
            <TextInput label="退勤" placeholder="HH:mm" {...editForm.getInputProps('clockOut')} />
            <Textarea label="メモ" minRows={2} {...editForm.getInputProps('note')} />
            <Button type="submit" loading={submitting}>
              保存する
            </Button>
          </Stack>
        </form>
      </Modal>

      <Modal opened={creating} onClose={() => setCreating(false)} title="勤怠を追加" centered>
        <form onSubmit={createForm.onSubmit(handleCreate)}>
          <Stack gap="sm">
            <DateInput
              label="日付"
              placeholder="日付を選択"
              valueFormat="YYYY/MM/DD"
              {...createForm.getInputProps('date')}
              required
            />
            <TextInput label="出勤" placeholder="HH:mm" {...createForm.getInputProps('clockIn')} />
            <Group grow>
              <TextInput label="休憩開始" placeholder="HH:mm" {...createForm.getInputProps('breakStart')} />
              <TextInput label="休憩終了" placeholder="HH:mm" {...createForm.getInputProps('breakEnd')} />
            </Group>
            <TextInput label="退勤" placeholder="HH:mm" {...createForm.getInputProps('clockOut')} />
            <Textarea label="メモ" minRows={2} {...createForm.getInputProps('note')} />
            <Button type="submit" loading={submitting}>
              追加する
            </Button>
          </Stack>
        </form>
      </Modal>
    </Card>
  );
}
