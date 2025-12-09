'use client';

import { createTheme } from '@mantine/core';



export const theme = createTheme({
  primaryColor: 'cyan',
  defaultRadius: 'md',
  fontFamily: 'var(--font-geist-sans)',
  headings: {
    fontFamily: 'var(--font-geist-sans)',
  },
  components: {
    Button: {
      defaultProps: {
        fw: 500,
      },
    },
    Card: {
      defaultProps: {
        withBorder: true,
        shadow: 'sm',
      },
    },
  },
});
