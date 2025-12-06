'use client';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import 'dayjs/locale/ja';
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import React from 'react';

type Props = {
  children: React.ReactNode;
};

export function Providers({ children }: Props) {
  return (
    <MantineProvider
      defaultColorScheme="light"
      theme={{
        primaryColor: 'blue',
        fontFamily: 'var(--font-geist-sans), system-ui, -apple-system, sans-serif',
        headings: { fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' },
      }}
    >
      <DatesProvider settings={{ locale: 'ja', firstDayOfWeek: 0 }}>
        {children}
      </DatesProvider>
    </MantineProvider>
  );
}

export default Providers;
