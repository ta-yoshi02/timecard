'use client';

import { Card, Group, Text, ThemeIcon, Stack } from '@mantine/core';
import { IconCoffee, IconBriefcase, IconHome } from '@tabler/icons-react';

type Props = {
    status: 'working' | 'break' | 'off';
    startTime?: string | null;
};

export function CurrentStatusCard({ status, startTime }: Props) {
    const config = {
        working: {
            label: '勤務中',
            color: 'teal',
            icon: IconBriefcase,
            description: 'お疲れ様です！',
        },
        break: {
            label: '休憩中',
            color: 'orange',
            icon: IconCoffee,
            description: 'リフレッシュしましょう',
        },
        off: {
            label: '勤務外',
            color: 'gray',
            icon: IconHome,
            description: '本日の業務はまだ始まっていません',
        },
    };

    const current = config[status];
    const Icon = current.icon;

    return (
        <Card padding="lg" radius="md" withBorder>
            <Group justify="space-between" align="flex-start">
                <Stack gap="xs">
                    <Text size="sm" c="dimmed" fw={700}>
                        CURRENT STATUS
                    </Text>
                    <TitleSection label={current.label} color={current.color} />
                    <Text size="sm" c="dimmed">
                        {current.description}
                    </Text>
                </Stack>
                <ThemeIcon size={48} radius="md" variant="light" color={current.color}>
                    <Icon size={28} />
                </ThemeIcon>
            </Group>

            {startTime && (
                <Group mt="lg" align="center">
                    <Text size="sm" c="dimmed">
                        開始時間:
                    </Text>
                    <Text size="xl" fw={700} style={{ fontFamily: 'monospace' }}>
                        {startTime}
                    </Text>
                </Group>
            )}
        </Card>
    );
}

function TitleSection({ label, color }: { label: string; color: string }) {
    return (
        <Text fz={28} fw={900} c={color} style={{ lineHeight: 1 }}>
            {label}
        </Text>
    );
}
