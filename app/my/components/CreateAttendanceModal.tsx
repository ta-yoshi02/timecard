'use client';

import { Button, Group, Modal, Stack, Textarea, TextInput } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { useState } from 'react';

type Props = {
    opened: boolean;
    onClose: () => void;
    onSuccess: () => void;
    employeeId?: string;
};

export function CreateAttendanceModal({ opened, onClose, onSuccess, employeeId }: Props) {
    const [submitting, setSubmitting] = useState(false);

    const form = useForm({
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

    const handleSubmit = async (values: typeof form.values) => {
        if (!values.date) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/clock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    employeeId,
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
            form.reset();
            onSuccess();
            onClose();
            notifications.show({
                title: '成功',
                message: '勤怠を追加しました',
                color: 'teal',
            });
        } catch (e) {
            notifications.show({
                title: 'エラー',
                message: e instanceof Error ? e.message : '作成に失敗しました',
                color: 'red',
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal opened={opened} onClose={onClose} title="勤怠を追加" centered>
            <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack gap="sm">
                    <DateInput
                        label="日付"
                        placeholder="日付を選択"
                        valueFormat="YYYY/MM/DD"
                        {...form.getInputProps('date')}
                        required
                    />
                    <TextInput label="出勤" placeholder="HH:mm" {...form.getInputProps('clockIn')} />
                    <Group grow>
                        <TextInput label="休憩開始" placeholder="HH:mm" {...form.getInputProps('breakStart')} />
                        <TextInput label="休憩終了" placeholder="HH:mm" {...form.getInputProps('breakEnd')} />
                    </Group>
                    <TextInput label="退勤" placeholder="HH:mm" {...form.getInputProps('clockOut')} />
                    <Textarea label="メモ" minRows={2} {...form.getInputProps('note')} />
                    <Button type="submit" loading={submitting}>
                        追加する
                    </Button>
                </Stack>
            </form>
        </Modal>
    );
}
