import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import dayjs from 'dayjs';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE_NAME, readSessionToken } from '@/lib/auth';

const normalizeDate = (date: Date | string) => dayjs(date).format('YYYY-MM-DD');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { searchParams } = new URL(request.url);
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'スタッフIDが必要です' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const isSelf = session?.employeeId === id;
  const isAdmin = session?.role === 'ADMIN';
  if (!isAdmin && !isSelf) {
    return NextResponse.json(
      { error: '権限がありません' },
      { status: 403 },
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
  });

  if (!employee) {
    return NextResponse.json(
      { error: '指定されたスタッフが見つかりません' },
      { status: 404 },
    );
  }

  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const where: { employeeId: string; date?: { gte?: Date; lte?: Date } } = {
    employeeId: id,
  };

  if (start || end) {
    where.date = {};
    if (start) where.date.gte = dayjs(start).startOf('day').toDate();
    if (end) where.date.lte = dayjs(end).endOf('day').toDate();
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    orderBy: [{ date: 'desc' }],
  });

  return NextResponse.json({
    employee,
    records: records.map((record) => ({
      ...record,
      date: normalizeDate(record.date),
    })),
  });
}
