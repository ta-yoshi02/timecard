'use client';

import { Badge, Group } from '@mantine/core';
import { AttendanceIssue } from '@/lib/attendance';

type Props = {
  issues: AttendanceIssue[];
};

const issueConfig: Record<AttendanceIssue, { label: string; color: string }> = {
  missingClockIn: { label: '出勤打刻なし', color: 'red' },
  missingClockOut: { label: '退勤打刻なし', color: 'red' },
  overwork: { label: '長時間勤務', color: 'orange' },
  insufficientBreak: { label: '休憩不足', color: 'yellow' },
  nightShift: { label: '深夜勤務', color: 'grape' },
};

export function StatusBadges({ issues }: Props) {
  const criticalIssues: AttendanceIssue[] = ['missingClockIn', 'missingClockOut', 'insufficientBreak'];
  const hasCriticalIssues = issues.some((issue) => criticalIssues.includes(issue));

  return (
    <Group gap={6} wrap="wrap">
      {!hasCriticalIssues && (
        <Badge color="green">問題なし</Badge>
      )}
      {issues.map((issue) => (
        <Badge key={issue} color={issueConfig[issue].color} variant="light">
          {issueConfig[issue].label}
        </Badge>
      ))}
    </Group>
  );
}

export default StatusBadges;
