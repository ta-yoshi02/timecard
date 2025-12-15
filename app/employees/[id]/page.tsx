'use client';

import { Badge, Button, Card, Group, Table, Text, Title, Modal, Stack, TextInput, Textarea, Select, Switch, NumberInput, Divider } from '@mantine/core';
import { useForm } from '@mantine/form';
import { MonthPickerInput, DateInput } from '@mantine/dates';
import { IconPlus, IconKey, IconCurrencyYen, IconUser } from '@tabler/icons-react';
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
import { AttendanceRecord, Employee, WageHistory } from '@/lib/types';
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

// Helper to get hourly rate for a specific date from history
const getHourlyRate = (date: string | Date, history: WageHistory[] | undefined, defaultRate: number) => {
  if (!history || history.length === 0) return defaultRate;
  const targetDate = dayjs(date);
  // History is ordered by effectiveDate desc
  const match = history.find(h => dayjs(h.effectiveDate).isBefore(targetDate) || dayjs(h.effectiveDate).isSame(targetDate, 'day'));
  return match ? match.hourlyRate : defaultRate;
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

  // Management Modals
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [wageModalOpen, setWageModalOpen] = useState(false);
  const [jobRoleModalOpen, setJobRoleModalOpen] = useState(false);

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
      if (latest && !selectedMonth) {
        setSelectedMonth(dayjs(latest).startOf('month').toDate());
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user?.role === 'ADMIN') {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const passwordForm = useForm({
    initialValues: {
      temp: true,
      password: '',
    },
    validate: {
      password: (value, values) => (!values.temp && !value ? 'パスワードを入力してください' : null),
    },
  });

  const wageForm = useForm({
    initialValues: {
      hourlyRate: 1000,
      effectiveDate: new Date(),
    },
    validate: {
      hourlyRate: (value) => (value <= 0 ? '正の数を入力してください' : null),
      effectiveDate: (value) => (!value ? '適用開始月を選択してください' : null),
    },
  });

  const jobRoleForm = useForm({
    initialValues: {
      jobRole: '',
    },
  });

  useEffect(() => {
    if (employee) {
      jobRoleForm.setValues({ jobRole: employee.jobRole });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee]);

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
      fetchData();
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
      fetchData();
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

  const handlePasswordReset = async (values: typeof passwordForm.values) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employees/${id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setPasswordModalOpen(false);
      passwordForm.reset();

      if (data.newPassword) {
        alert(`新しい仮パスワード: ${data.newPassword}\n(この画面を閉じると二度と表示されません)`);
      } else {
        notifications.show({ title: '成功', message: 'パスワードをリセットしました', color: 'teal' });
      }
    } catch (e) {
      notifications.show({ title: 'エラー', message: e instanceof Error ? e.message : '失敗しました', color: 'red' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddWageHistory = async (values: typeof wageForm.values) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employees/${id}/wage-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setWageModalOpen(false);
      wageForm.reset();
      fetchData();
      notifications.show({ title: '成功', message: '時給履歴を追加しました', color: 'teal' });
    } catch (e) {
      notifications.show({ title: 'エラー', message: e instanceof Error ? e.message : '失敗しました', color: 'red' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateJobRole = async (values: typeof jobRoleForm.values) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: employee?.name,
          hourlyRate: employee?.hourlyRate,
          role: employee?.role,
          jobRole: values.jobRole,
        }),
      });
      if (!res.ok) throw new Error('更新に失敗しました');
      setJobRoleModalOpen(false);
      fetchData();
      notifications.show({ title: '成功', message: '職務を更新しました', color: 'teal' });
    } catch {
      notifications.show({ title: 'エラー', message: '更新に失敗しました', color: 'red' });
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
      // Use historical rate
      const rate = getHourlyRate(record.date, employee.wageHistory, employee.hourlyRate);
      return acc + calculatePay(record, rate).pay;
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
        <Button variant="light" onClick={() => router.push('/admin')}>
          スタッフ一覧へ戻る
        </Button>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      <Card shadow="xs" padding="md" radius="md" withBorder>
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="xs" align="center">
              <Title order={2}>{employee.name}</Title>
              <Badge size="lg" variant="filled" color="blue">{employee.jobRole || 'STAFF'}</Badge>
              {employee.role === 'ADMIN' && <Badge variant="outline" color="red">管理者</Badge>}
            </Group>
            <Text c="dimmed" mt="xs">
              現在の基本時給: {formatCurrency(employee.hourlyRate)}
            </Text>
          </div>
          <Group>
            <Button leftSection={<IconUser size={16} />} variant="default" size="xs" onClick={() => setJobRoleModalOpen(true)}>
              職務変更
            </Button>
            <Button leftSection={<IconCurrencyYen size={16} />} variant="default" size="xs" onClick={() => setWageModalOpen(true)}>
              時給管理
            </Button>
            <Button leftSection={<IconKey size={16} />} variant="default" size="xs" onClick={() => setPasswordModalOpen(true)}>
              パスワード管理
            </Button>
          </Group>
        </Group>

        <Divider my="md" />

        <Group justify="space-between" mb="md" align="flex-end">
          <div>
            <Text fw={500}>{monthLabel} の勤怠サマリー</Text>
            <Text size="sm" c="dimmed">{rangeLabel}</Text>
          </div>
          <MonthPickerInput
            placeholder="月を選択"
            value={selectedMonth ?? monthStart}
            onChange={(value) => setSelectedMonth(value ? dayjs(value as Date | string).toDate() : null)}
            valueFormat="YYYY年M月"
            maxDate={latestDate ?? undefined}
            clearable={false}
            w={150}
          />
        </Group>

        <Group gap="xs" mb="md">
          <Badge color="blue" variant="light" size="lg">
            概算給与: {formatCurrency(Math.round(monthly.pay))}
          </Badge>
          <Badge color="green" variant="light" size="lg">
            勤務時間: {formatTotalHours(monthly.hours)}
          </Badge>
          <Badge color={monthly.missing > 0 ? 'red' : 'green'} variant="light" size="lg">
            打刻異常: {monthly.missing} 件
          </Badge>
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
              <Table.Th>適用時給</Table.Th>
              <Table.Th>日額(概算)</Table.Th>
              <Table.Th>メモ</Table.Th>
              <Table.Th>ステータス</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {records.map((record, index) => {
              const issues = recordIssues[index];
              const hours = calculateDailyHours(record);
              const rate = getHourlyRate(record.date, employee.wageHistory, employee.hourlyRate);
              const dayPay =
                employee && hours
                  ? calculatePay(record, rate).pay
                  : undefined;
              return (
                <Table.Tr
                  key={record.id}
                  onClick={() => setEditingRecord(record)}
                  style={{ cursor: 'pointer' }}
                >
                  <Table.Td>
                    <Text fw={600}>{dayjs(record.date).format('M/D')}</Text>
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
                  <Table.Td>{formatCurrency(rate)}</Table.Td>
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
          <Text c="dimmed" ta="center" py="xl">
            {monthLabel} に表示できる打刻データがありません。
          </Text>
        )}
      </Card>

      {/* Edit Record Modal */}
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

      {/* Create Record Modal */}
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

      {/* Password Modal */}
      <Modal opened={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title="パスワード管理" centered>
        <form onSubmit={passwordForm.onSubmit(handlePasswordReset)}>
          <Stack>
            <Text size="sm" c="dimmed">
              従業員のログインパスワードをリセットします。
            </Text>
            <Switch
              label="仮パスワードを自動生成する"
              {...passwordForm.getInputProps('temp', { type: 'checkbox' })}
            />
            {!passwordForm.values.temp && (
              <TextInput
                label="新しいパスワード"
                placeholder="パスワードを入力"
                required
                {...passwordForm.getInputProps('password')}
              />
            )}
            <Button type="submit" loading={submitting} color="red">
              パスワードをリセット
            </Button>
          </Stack>
        </form>
      </Modal>

      {/* Wage Modal */}
      <Modal opened={wageModalOpen} onClose={() => setWageModalOpen(false)} title="時給管理" centered>
        <Stack>
          <Text size="sm" fw={500}>時給履歴</Text>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>適用開始月</Table.Th>
                <Table.Th>時給</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {employee?.wageHistory?.map((h) => (
                <Table.Tr key={h.id}>
                  <Table.Td>{dayjs(h.effectiveDate).format('YYYY年M月')}</Table.Td>
                  <Table.Td>{formatCurrency(h.hourlyRate)}</Table.Td>
                </Table.Tr>
              ))}
              {(!employee?.wageHistory || employee.wageHistory.length === 0) && (
                <Table.Tr>
                  <Table.Td colSpan={2} align="center">履歴なし</Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>

          <Divider my="xs" label="新しい時給を設定" labelPosition="center" />

          <form onSubmit={wageForm.onSubmit(handleAddWageHistory)}>
            <Stack>
              <NumberInput
                label="新しい時給"
                min={0}
                step={10}
                required
                {...wageForm.getInputProps('hourlyRate')}
              />
              <MonthPickerInput
                label="適用開始月"
                placeholder="月を選択"
                required
                {...wageForm.getInputProps('effectiveDate')}
              />
              <Button type="submit" loading={submitting}>
                追加する
              </Button>
            </Stack>
          </form>
        </Stack>
      </Modal>

      {/* Job Role Modal */}
      <Modal opened={jobRoleModalOpen} onClose={() => setJobRoleModalOpen(false)} title="職務変更" centered>
        <form onSubmit={jobRoleForm.onSubmit(handleUpdateJobRole)}>
          <Stack>
            <Select
              label="職務"
              data={[
                { value: 'KITCHEN', label: 'キッチン' },
                { value: 'HALL', label: 'ホール' },
                { value: 'STAFF', label: 'スタッフ' },
                { value: 'MANAGER', label: '店長' },
              ]}
              required
              {...jobRoleForm.getInputProps('jobRole')}
            />
            <Button type="submit" loading={submitting}>
              更新する
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
