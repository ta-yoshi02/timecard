'use client';

import { Card, Stack } from '@mantine/core';
import { useEffect, useState } from 'react';
import Clock from 'react-clock';

type Props = {
    size?: number;
};

export function AnalogClock({ size = 200 }: Props) {
    const [value, setValue] = useState<Date>(() => new Date());

    useEffect(() => {
        const tick = () => setValue(new Date());
        const timer = setInterval(tick, 1000);
        tick();
        return () => {
            clearInterval(timer);
        };
    }, []);

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
