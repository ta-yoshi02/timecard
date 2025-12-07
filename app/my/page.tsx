'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, useRequireRole } from '../components/AuthProvider';
import StatusBadges from '../components/StatusBadges';
import { calculateDailyHours, detectIssues } from '@/lib/attendance';
import { AttendanceRecord } from '@/lib/types';

const formatHours = (hours: number | null) => {
  if (hours === null) return '-';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}時間${m}分`;
};

export default function MyAttendancePage() {
  const { user, employee, loading: authLoading } = useAuth();
  useRequireRole('EMPLOYEE');

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clocking, setClocking] = useState<
    'clockIn' | 'clockOut' | 'breakStart' | 'breakEnd' | null
  >(null);
  const [editing, setEditing] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!user || user.role !== 'EMPLOYEE') return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/me/records?days=14');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `API error: ${res.status}`);
      }
      setRecords(data.records ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && user?.role === 'EMPLOYEE') {
      fetchRecords();
    }
  }, [authLoading, user, fetchRecords]);

  const today = dayjs().format('YYYY-MM-DD');
  const todayRecord = useMemo(
    () => records.find((record) => record.date === today),
    [records, today],
  );

  const hasClockIn = !!todayRecord?.clockIn;
  const hasClockOut = !!todayRecord?.clockOut;
  const onBreak = !!todayRecord?.breakStart && !todayRecord?.breakEnd;
  const working = hasClockIn && !hasClockOut && !onBreak;
  const preOrPost = !hasClockIn || (hasClockIn && hasClockOut);

  const handleClock = async (action: 'clockIn' | 'clockOut' | 'breakStart' | 'breakEnd') => {
    setClocking(action);
    setError(null);
    try {
      const res = await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? '打刻に失敗しました');
      }
      await fetchRecords();
    } catch (e) {
      setError(e instanceof Error ? e.message : '打刻に失敗しました');
    } finally {
      setClocking(null);
    }
  };

  const editForm = useForm({
    initialValues: {
      clockIn: '',
      clockOut: '',
      breakStart: '',
      breakEnd: '',
      note: '',
    },
  });

  useEffect(() => {
    if (!editing) return;
    editForm.setValues({
      clockIn: todayRecord?.clockIn ?? '',
      clockOut: todayRecord?.clockOut ?? '',
      breakStart: todayRecord?.breakStart ?? '',
      breakEnd: todayRecord?.breakEnd ?? '',
      note: todayRecord?.note ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, todayRecord]);

  const handleUpdate = async (values: typeof editForm.values) => {
    setClocking('clockIn'); // reuse loading state indicator
    setError(null);
    try {
      const res = await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          ...values,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? '修正に失敗しました');
      }
      setEditing(false);
      await fetchRecords();
    } catch (e) {
      setError(e instanceof Error ? e.message : '修正に失敗しました');
    } finally {
      setClocking(null);
    }
  };

  const renderStatus = () => {
    const issues = todayRecord ? detectIssues(todayRecord) : [];
    if (!todayRecord) return <Text c="dimmed">本日の打刻はまだありません。</Text>;
    return (
      <Group gap="xs">
        <Badge color="blue" variant="light">
          出勤: {todayRecord.clockIn ?? '--:--'}
        </Badge>
        <Badge color="orange" variant="light">
          休憩開始: {todayRecord.breakStart ?? '--:--'}
        </Badge>
        <Badge color="yellow" variant="light">
          休憩終了: {todayRecord.breakEnd ?? '--:--'}
        </Badge>
        <Badge color="teal" variant="light">
          退勤: {todayRecord.clockOut ?? '--:--'}
        </Badge>
        <Badge color="gray" variant="light">
          実働: {formatHours(calculateDailyHours(todayRecord))}
        </Badge>
        <StatusBadges issues={issues} />
      </Group>
    );
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>マイ打刻</Title>
          <Text c="dimmed" size="sm">
            {employee?.name ?? '従業員'} さんの勤怠。出勤/退勤や休憩を記録し、必要に応じて修正できます。
          </Text>
        </div>
        <Group gap="xs">
          {preOrPost && (
            <>
              <Button
                onClick={() => handleClock('clockIn')}
                disabled={hasClockIn}
                loading={clocking === 'clockIn'}
              >
                出勤を打刻
              </Button>
              <Button variant="light" onClick={() => setEditing(true)}>
                修正
              </Button>
            </>
          )}
          {working && (
            <>
              <Button
                onClick={() => handleClock('breakStart')}
                disabled={onBreak}
                loading={clocking === 'breakStart'}
              >
                休憩開始
              </Button>
              <Button variant="light" onClick={() => setEditing(true)}>
                修正
              </Button>
              <Button
                variant="light"
                color="teal"
                onClick={() => handleClock('clockOut')}
                disabled={hasClockOut}
                loading={clocking === 'clockOut'}
              >
                退勤
              </Button>
            </>
          )}
          {onBreak && (
            <>
              <Button
                color="orange"
                onClick={() => handleClock('breakEnd')}
                loading={clocking === 'breakEnd'}
              >
                休憩終了
              </Button>
              <Button variant="light" onClick={() => setEditing(true)}>
                修正
              </Button>
            </>
          )}
        </Group>
      </Group>

      {error && (
        <Alert color="red" title="エラー">
          {error}
        </Alert>
      )}

      <Card shadow="xs" padding="md" radius="md" withBorder>
        <Group justify="space-between" mb="sm">
          <div>
            <Text fw={600}>本日の状態</Text>
            <Text c="dimmed" size="sm">
              {dayjs().format('YYYY年M月D日')} の打刻と実働
            </Text>
          </div>
        </Group>
        {renderStatus()}
      </Card>

      <Card shadow="xs" padding="md" radius="md" withBorder>
        <Group justify="space-between" mb="sm">
          <div>
            <Text fw={600}>直近の勤怠</Text>
            <Text c="dimmed" size="sm">
              過去14日分の打刻履歴
            </Text>
          </div>
        </Group>
        <Table verticalSpacing="sm" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>日付</Table.Th>
              <Table.Th>出勤</Table.Th>
              <Table.Th>休憩開始</Table.Th>
              <Table.Th>休憩終了</Table.Th>
              <Table.Th>退勤</Table.Th>
              <Table.Th>実働</Table.Th>
              <Table.Th>休憩(分)</Table.Th>
              <Table.Th>メモ</Table.Th>
              <Table.Th>ステータス</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {records.map((record) => {
              const issues = detectIssues(record);
              const hours = calculateDailyHours(record);
              return (
                <Table.Tr key={record.id}>
                  <Table.Td>{dayjs(record.date).format('M/D')}</Table.Td>
                  <Table.Td>{record.clockIn ?? '-'}</Table.Td>
                  <Table.Td>{record.breakStart ?? '-'}</Table.Td>
                  <Table.Td>{record.breakEnd ?? '-'}</Table.Td>
                  <Table.Td>{record.clockOut ?? '-'}</Table.Td>
                  <Table.Td>{formatHours(hours)}</Table.Td>
                  <Table.Td>{typeof record.breakMinutes === 'number' ? record.breakMinutes : '-'}</Table.Td>
                  <Table.Td>{record.note ?? '-'}</Table.Td>
                  <Table.Td>
                    <StatusBadges issues={issues} />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
        {(loading || authLoading) && (
          <Card padding="md" radius="md" withBorder mt="md">
            <Text c="dimmed">読み込み中...</Text>
          </Card>
        )}
        {!loading && records.length === 0 && (
          <Card padding="md" radius="md" withBorder mt="md">
            <Text c="dimmed">表示できる勤怠データがありません。</Text>
          </Card>
        )}
      </Card>

      <Modal opened={editing} onClose={() => setEditing(false)} title="本日の打刻を修正" centered>
        <form onSubmit={editForm.onSubmit(handleUpdate)}>
          <Stack gap="sm">
            <TextInput label="出勤" placeholder="HH:mm" {...editForm.getInputProps('clockIn')} />
            <Group grow>
              <TextInput label="休憩開始" placeholder="HH:mm" {...editForm.getInputProps('breakStart')} />
              <TextInput label="休憩終了" placeholder="HH:mm" {...editForm.getInputProps('breakEnd')} />
            </Group>
            <TextInput label="退勤" placeholder="HH:mm" {...editForm.getInputProps('clockOut')} />
            <Textarea label="メモ" minRows={2} {...editForm.getInputProps('note')} />
            <Button type="submit" loading={clocking !== null}>
              保存する
            </Button>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
