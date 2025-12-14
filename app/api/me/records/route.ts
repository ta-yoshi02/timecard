import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import dayjs from 'dayjs';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE_NAME, readSessionToken } from '@/lib/auth';

const normalizeDate = (date: Date | string) => dayjs(date).format('YYYY-MM-DD');

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionToken(token);

  if (!session || session.role !== 'EMPLOYEE' || !session.employeeId) {
    return NextResponse.json(
      { error: '従業員アカウントでのログインが必要です' },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const daysParam = Number(searchParams.get('days') ?? 14);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const end = endParam
    ? dayjs(endParam).endOf('day')
    : dayjs().endOf('day');
  const days = Number.isNaN(daysParam) || daysParam <= 0 ? 14 : daysParam;
  const start = startParam
    ? dayjs(startParam).startOf('day')
    : end.subtract(days - 1, 'day').startOf('day');

  const records = await prisma.attendanceRecord.findMany({
    where: {
      employeeId: session.employeeId,
      date: {
        gte: start.toDate(),
        lte: end.toDate(),
      },
    },
    orderBy: [{ date: 'desc' }],
  });

  return NextResponse.json({
    records: records.map((record) => ({
      ...record,
      date: normalizeDate(record.date),
    })),
  });
}
