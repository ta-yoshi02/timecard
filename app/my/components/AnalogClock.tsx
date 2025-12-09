'use client';

import { Card, Center, Text, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import Clock from 'react-clock';

type Props = {
    size?: number;
};

export function AnalogClock({ size = 200 }: Props) {
    const [value, setValue] = useState<Date | null>(null);

    useEffect(() => {
        const timer = setInterval(() => setValue(new Date()), 1000);
        return () => {
            clearInterval(timer);
        };
    }, []);

    if (!value) {
        return (
            <Card padding="md" radius="md" withBorder mb="md" h={size + 40}>
                <Center h="100%">
                    <Text c="dimmed">Loading...</Text>
                </Center>
            </Card>
        );
    }

    return (
        <Card padding="md" radius="md" withBorder mb="md">
            <Stack align="center" gap="xs">
                <Clock
                    value={value}
                    size={size}
                    renderNumbers={true}
                    hourHandWidth={4}
                    hourHandLength={60}
                    minuteHandWidth={3}
                    minuteHandLength={80}
                    secondHandWidth={1}
                    secondHandLength={90}
                />
            </Stack>
        </Card>
    );
}
