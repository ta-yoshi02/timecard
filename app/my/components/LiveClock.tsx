'use client';

import { Card, Group, Text, ThemeIcon } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

export function LiveClock() {
    const [time, setTime] = useState<dayjs.Dayjs | null>(null);

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(dayjs());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    if (!time) {
        return (
            <Card padding="md" radius="md" withBorder mb="md">
                <Group justify="center">
                    <Text c="dimmed">Loading...</Text>
                </Group>
            </Card>
        );
    }

    return (
        <Card padding="md" radius="md" withBorder mb="md">
            <Group justify="center" gap="md">
                <ThemeIcon variant="light" size="xl" color="blue" radius="md">
                    <IconClock size={24} />
                </ThemeIcon>
                <Text fz={36} fw={900} style={{ fontFamily: 'monospace', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {time.format('HH:mm:ss')}
                </Text>
            </Group>
        </Card>
    );
}
