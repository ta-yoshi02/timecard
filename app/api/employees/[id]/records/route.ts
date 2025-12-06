import { NextResponse } from 'next/server';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { AttendanceRecord, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

dayjs.extend(isSameOrAfter);

const normalizeDate = (date: Date | string) => dayjs(date).format('YYYY-MM-DD');

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const daysParam = searchParams.get('days');
  const days = daysParam ? Number(daysParam) : null;
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const employee = await prisma.employee.findUnique({
    where: { id },
  });

  if (!employee) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const where: Prisma.AttendanceRecordWhereInput = { employeeId: id };
  if (start || end) {
    where.date = {};
    if (start) where.date.gte = dayjs(start).startOf('day').toDate();
    if (end) where.date.lte = dayjs(end).endOf('day').toDate();
  }

  const allRecords: AttendanceRecord[] = await prisma.attendanceRecord.findMany({
    where,
    orderBy: { date: 'desc' },
  });

  let records: AttendanceRecord[] = allRecords;
  if (!start && !end && days && allRecords.length > 0) {
    const latestDate = dayjs(allRecords[0].date);
    const start = latestDate.subtract(days - 1, 'day');
    records = allRecords.filter((r) => dayjs(r.date).isSameOrAfter(start, 'day'));
  }

  const mappedRecords = records.map((record) => ({
    ...record,
    date: normalizeDate(record.date),
  }));

  return NextResponse.json({ employee, records: mappedRecords });
}
