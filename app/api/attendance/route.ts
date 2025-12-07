import { NextResponse } from 'next/server';
import dayjs from 'dayjs';
import prisma from '@/lib/prisma';

type DbEmployee = {
  id: string;
  name: string;
  role: string;
  hourlyRate: number;
};

type DbAttendanceRecord = {
  id: string;
  employeeId: string;
  date: Date;
  clockIn?: string | null;
  clockOut?: string | null;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  breakMinutes?: number | null;
  note?: string | null;
};

const normalizeDate = (date: Date | string) => dayjs(date).format('YYYY-MM-DD');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const where: { date?: { gte?: Date; lte?: Date } } = {};
  if (start || end) {
    where.date = {};
    if (start) where.date.gte = dayjs(start).startOf('day').toDate();
    if (end) where.date.lte = dayjs(end).endOf('day').toDate();
  }

  const [employees, records]: [DbEmployee[], DbAttendanceRecord[]] = await Promise.all([
    prisma.employee.findMany({ orderBy: { name: 'asc' } }),
    prisma.attendanceRecord.findMany({
      where,
      orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
    }),
  ]);

  const mappedRecords = records.map((record) => ({
    ...record,
    date: normalizeDate(record.date),
  }));

  return NextResponse.json({
    employees,
    records: mappedRecords,
  });
}
