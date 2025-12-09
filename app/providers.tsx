'use client';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import 'dayjs/locale/ja';
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import { AuthProvider } from './components/AuthProvider';
import React from 'react';
import { theme } from './theme';

type Props = {
  children: React.ReactNode;
};

export function Providers({ children }: Props) {
  return (
    <MantineProvider
      defaultColorScheme="light"
      theme={theme}
    >
      <Notifications />
      <DatesProvider settings={{ locale: 'ja', firstDayOfWeek: 0 }}>
        <AuthProvider>{children}</AuthProvider>
      </DatesProvider>
    </MantineProvider>
  );
}

export default Providers;
