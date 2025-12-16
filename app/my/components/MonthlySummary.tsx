'use client';

import { Badge, Card, Group, Table, Text, Title } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import StatusBadges from '@/app/components/StatusBadges';
import { calculateDailyHours, detectIssues, calculatePay } from '@/lib/attendance';
import { AttendanceRecord } from '@/lib/types';

type Props = {
  records: AttendanceRecord[];
  selectedMonth: Date | null;
  onMonthChange: (value: Date | null) => void;
  hourlyRate?: number;
  loading?: boolean;
  headerAction?: React.ReactNode;
};

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

const issuesToCount = (recordsIssues: ReturnType<typeof detectIssues>[]) => {
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

export function MonthlySummary({
  records,
  selectedMonth,
  onMonthChange,
  hourlyRate,
  loading,
  headerAction,
}: Props) {
  const monthStart = selectedMonth
    ? dayjs(selectedMonth).startOf('month').toDate()
    : null;
  const monthEnd = monthStart ? dayjs(monthStart).endOf('month').toDate() : null;

  const totals = useMemo(() => {
    const issues = issuesToCount(records.map((record) => detectIssues(record)));
    const hours = records.reduce((acc, record) => {
      const h = calculateDailyHours(record);
      return acc + (h ?? 0);
    }, 0);
    const pay =
      typeof hourlyRate === 'number'
        ? records.reduce((acc, record) => acc + calculatePay(record, hourlyRate).pay, 0)
        : undefined;

    return {
      hours,
      pay,
      missing: issues.missing,
      overwork: issues.overwork,
    };
  }, [records, hourlyRate]);

  const monthLabel = monthStart ? dayjs(monthStart).format('YYYY年M月') : '未選択';
  const monthRangeText =
    monthStart && monthEnd
      ? `${dayjs(monthStart).format('M/D')} 〜 ${dayjs(monthEnd).format('M/D')}`
      : '範囲なし';

  return (
    <Card padding="md" radius="md" withBorder>
      <Group justify="space-between" mb="md" align="flex-end">
        <div>
          <Title order={3}>月次サマリー</Title>
          <Text c="dimmed" size="sm">
            {monthLabel} の勤怠状況（{monthRangeText}）
          </Text>
        </div>
        <Group>
          {headerAction}
          <MonthPickerInput
            placeholder="月を選択"
            value={monthStart}
            onChange={(value) =>
              onMonthChange(
                value
                  ? dayjs(value as Date | string).startOf('month').toDate()
                  : null,
              )
            }
            valueFormat="YYYY年M月"
            maxDate={dayjs().endOf('month').toDate()}
            clearable={false}
          />
        </Group>
      </Group>

      {loading ? (
        <Text c="dimmed">読み込み中...</Text>
      ) : records.length === 0 ? (
        <Text c="dimmed">
          {monthLabel} に表示できる打刻データがありません。
        </Text>
      ) : (
        <>
          <Group gap="xs" mb="sm">
            <Badge color="blue" variant="light">
              勤務日数: {records.length}日
            </Badge>
            <Badge color="green" variant="light">
              勤務時間: {formatTotalHours(totals.hours)}
            </Badge>
            {typeof totals.pay === 'number' && (
              <Badge color="grape" variant="light">
                概算給与: {formatCurrency(totals.pay)}
              </Badge>
            )}
            <Badge color={totals.missing > 0 ? 'red' : 'gray'} variant="light">
              打刻異常: {totals.missing}件
            </Badge>
            <Badge color={totals.overwork > 0 ? 'orange' : 'gray'} variant="light">
              長時間勤務: {totals.overwork}件
            </Badge>
          </Group>

          <Table.ScrollContainer minWidth={800}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>日付</Table.Th>
                  <Table.Th>出勤</Table.Th>
                  <Table.Th>退勤</Table.Th>
                  <Table.Th>休憩</Table.Th>
                  <Table.Th>実働</Table.Th>
                  <Table.Th>日額(概算)</Table.Th>
                  <Table.Th>メモ</Table.Th>
                  <Table.Th>ステータス</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {records.map((record) => {
                  const issues = detectIssues(record);
                  const hours = calculateDailyHours(record);
                  const dayPay =
                    typeof hourlyRate === 'number'
                      ? calculatePay(record, hourlyRate).pay
                      : undefined;
                  return (
                    <Table.Tr key={record.id}>
                      <Table.Td>
                        <Text fw={600}>{dayjs(record.date).format('M/D')}</Text>
                      </Table.Td>
                      <Table.Td>{record.clockIn ?? '-'}</Table.Td>
                      <Table.Td>{record.clockOut ?? '-'}</Table.Td>
                      <Table.Td>
                        {typeof record.breakMinutes === 'number'
                          ? `${record.breakMinutes}分`
                          : '-'}
                      </Table.Td>
                      <Table.Td>{formatHours(hours)}</Table.Td>
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
          </Table.ScrollContainer>
        </>
      )}
    </Card>
  );
}
