'use client';

import { Button, SimpleGrid } from '@mantine/core';
import { IconLogin, IconLogout, IconCoffee, IconPlayerPlay } from '@tabler/icons-react';

type Props = {
    status: 'working' | 'break' | 'off';
    onClockIn: () => void;
    onClockOut: () => void;
    onBreakStart: () => void;
    onBreakEnd: () => void;
    loading?: boolean;
    disabled?: boolean;
};

export function ActionButtons({
    status,
    onClockIn,
    onClockOut,
    onBreakStart,
    onBreakEnd,
    loading,
    disabled,
}: Props) {
    if (status === 'off') {
        return (
            <Button
                fullWidth
                size="xl"
                h={80}
                color="teal"
                onClick={onClockIn}
                loading={loading}
                disabled={disabled}
                leftSection={<IconLogin size={32} />}
                styles={{ label: { fontSize: 20 } }}
            >
                出勤する
            </Button>
        );
    }

    if (status === 'working') {
        return (
            <SimpleGrid cols={2}>
                <Button
                    fullWidth
                    size="xl"
                    h={80}
                    color="orange"
                    onClick={onBreakStart}
                    loading={loading}
                    disabled={disabled}
                    leftSection={<IconCoffee size={32} />}
                    styles={{ label: { fontSize: 18 } }}
                >
                    休憩開始
                </Button>
                <Button
                    fullWidth
                    size="xl"
                    h={80}
                    color="red"
                    variant="light"
                    onClick={onClockOut}
                    loading={loading}
                    disabled={disabled}
                    leftSection={<IconLogout size={32} />}
                    styles={{ label: { fontSize: 18 } }}
                >
                    退勤する
                </Button>
            </SimpleGrid>
        );
    }

    if (status === 'break') {
        return (
            <Button
                fullWidth
                size="xl"
                h={80}
                color="blue"
                onClick={onBreakEnd}
                loading={loading}
                disabled={disabled}
                leftSection={<IconPlayerPlay size={32} />}
                styles={{ label: { fontSize: 20 } }}
            >
                休憩終了
            </Button>
        );
    }

    return null;
}
