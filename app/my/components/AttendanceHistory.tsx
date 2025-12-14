'use client';

import { Card, Table, Text, Group } from '@mantine/core';
import dayjs from 'dayjs';
import { AttendanceRecord } from '@/lib/types';
import { calculateDailyHours, detectIssues } from '@/lib/attendance';
import StatusBadges from '@/app/components/StatusBadges';

type Props = {
    records: AttendanceRecord[];
    loading?: boolean;
    onEdit?: (record: AttendanceRecord) => void;
    headerAction?: React.ReactNode;
};

const formatHours = (hours: number | null) => {
    if (hours === null) return '-';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}時間${m}分`;
};

export function AttendanceHistory({ records, loading, onEdit, headerAction }: Props) {
    if (loading) {
        return (
            <Card padding="md" radius="md" withBorder>
                <Text c="dimmed" ta="center">読み込み中...</Text>
            </Card>
        );
    }

    if (records.length === 0) {
        return (
            <Card padding="md" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                    <div>
                        <Text fw={600}>直近の勤怠</Text>
                        <Text c="dimmed" size="sm">
                            過去14日分の履歴
                        </Text>
                    </div>
                    {headerAction}
                </Group>
                <Text c="dimmed" ta="center" py="xl">表示できる勤怠データがありません。</Text>
            </Card>
        );
    }

    return (
        <Card padding="md" radius="md" withBorder>
            <Group justify="space-between" mb="md">
                <div>
                    <Text fw={600}>直近の勤怠</Text>
                    <Text c="dimmed" size="sm">
                        過去14日分の履歴
                    </Text>
                </div>
                {headerAction}
            </Group>
            <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>日付</Table.Th>
                        <Table.Th>出勤</Table.Th>
                        <Table.Th>退勤</Table.Th>
                        <Table.Th>休憩</Table.Th>
                        <Table.Th>実働</Table.Th>
                        <Table.Th>ステータス</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {records.map((record) => {
                        const issues = detectIssues(record);
                        const hours = calculateDailyHours(record);
                        return (
                            <Table.Tr
                                key={record.id}
                                onClick={() => onEdit?.(record)}
                                style={{ cursor: onEdit ? 'pointer' : 'default' }}
                            >
                                <Table.Td>
                                    <Text size="sm" fw={500}>
                                        {dayjs(record.date).format('M/D')}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                        {dayjs(record.date).format('ddd')}
                                    </Text>
                                </Table.Td>
                                <Table.Td>{record.clockIn ?? '-'}</Table.Td>
                                <Table.Td>{record.clockOut ?? '-'}</Table.Td>
                                <Table.Td>
                                    {typeof record.breakMinutes === 'number' ? `${record.breakMinutes}分` : '-'}
                                </Table.Td>
                                <Table.Td>
                                    <Text fw={500}>{formatHours(hours)}</Text>
                                </Table.Td>
                                <Table.Td>
                                    <StatusBadges issues={issues} />
                                </Table.Td>
                            </Table.Tr>
                        );
                    })}
                </Table.Tbody>
            </Table>
        </Card>
    );
}
