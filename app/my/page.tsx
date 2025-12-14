'use client';

import {
  Container,
  Grid,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Button,
} from '@mantine/core';

import { IconPlus } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, useRequireRole } from '../components/AuthProvider';
import { AttendanceRecord } from '@/lib/types';
import { CurrentStatusCard } from './components/CurrentStatusCard';
import { ActionButtons } from './components/ActionButtons';
import { AttendanceHistory } from './components/AttendanceHistory';
import { LiveClock } from './components/LiveClock';
import { AnalogClock } from './components/AnalogClock';
import { notifications } from '@mantine/notifications';
import { CreateAttendanceModal } from './components/CreateAttendanceModal';

export default function MyAttendancePage() {
  const { user, employee, loading: authLoading } = useAuth();
  useRequireRole('EMPLOYEE');

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState<
    'clockIn' | 'clockOut' | 'breakStart' | 'breakEnd' | null
  >(null);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!user || user.role !== 'EMPLOYEE') return;
    setLoading(true);
    try {
      const res = await fetch('/api/me/records?days=14');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `API error: ${res.status}`);
      }
      setRecords(data.records ?? []);
    } catch (e) {
      notifications.show({
        title: 'エラー',
        message: e instanceof Error ? e.message : 'データ取得に失敗しました',
        color: 'red',
      });
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

  // Determine current status for UI
  const currentStatus = useMemo(() => {
    if (onBreak) return 'break';
    if (working) return 'working';
    return 'off';
  }, [onBreak, working]);

  const handleClock = async (action: 'clockIn' | 'clockOut' | 'breakStart' | 'breakEnd') => {
    setClocking(action);
    try {
      const res = await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          clientTime: dayjs().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? '打刻に失敗しました');
      }
      await fetchRecords();
      notifications.show({
        title: '成功',
        message: '打刻しました',
        color: 'teal',
      });
    } catch (e) {
      notifications.show({
        title: 'エラー',
        message: e instanceof Error ? e.message : '打刻に失敗しました',
        color: 'red',
      });
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
    setClocking('clockIn'); // reuse loading state indicator
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
      await fetchRecords();
      notifications.show({
        title: '成功',
        message: '修正を保存しました',
        color: 'teal',
      });
    } catch (e) {
      notifications.show({
        title: 'エラー',
        message: e instanceof Error ? e.message : '修正に失敗しました',
        color: 'red',
      });
    } finally {
      setClocking(null);
    }
  };


  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-end">
          <div>
            <Title order={2}>
              こんにちは、{employee?.name ?? '従業員'}さん
            </Title>
            <Text c="dimmed" size="lg">
              {dayjs().format('YYYY年M月D日 (ddd)')}
            </Text>
          </div>
          <Button variant="subtle" size="sm" onClick={() => todayRecord && setEditingRecord(todayRecord)}>
            本日の打刻を修正
          </Button>
        </Group>

        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack align="center" gap="lg">
              <LiveClock />
              <AnalogClock size={250} />
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack>
              <CurrentStatusCard
                status={currentStatus}
                startTime={
                  currentStatus === 'working' ? todayRecord?.clockIn :
                    currentStatus === 'break' ? todayRecord?.breakStart :
                      null
                }
              />
              <ActionButtons
                status={currentStatus}
                onClockIn={() => handleClock('clockIn')}
                onClockOut={() => handleClock('clockOut')}
                onBreakStart={() => handleClock('breakStart')}
                onBreakEnd={() => handleClock('breakEnd')}
                loading={clocking !== null}
                disabled={hasClockOut}
              />
              {hasClockOut && (
                <Text c="dimmed" size="sm" ta="center">
                  本日の業務は終了しました
                </Text>
              )}
            </Stack>
          </Grid.Col>
          <Grid.Col span={12}>
            <AttendanceHistory
              records={records}
              loading={loading}
              onEdit={setEditingRecord}
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
          </Grid.Col>
        </Grid>

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
              <Button type="submit" loading={clocking !== null}>
                保存する
              </Button>
            </Stack>
          </form>
        </Modal>

        <CreateAttendanceModal
          opened={creating}
          onClose={() => setCreating(false)}
          onSuccess={fetchRecords}
        />
      </Stack>
    </Container>
  );
}
