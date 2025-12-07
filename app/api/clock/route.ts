import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import dayjs from 'dayjs';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE_NAME, readSessionToken } from '@/lib/auth';

const normalizeDate = (date: Date | string) => dayjs(date).format('YYYY-MM-DD');

type ClockAction = 'clockIn' | 'clockOut' | 'breakStart' | 'breakEnd' | 'update';

const calcBreakMinutes = (record: { date: Date; breakStart?: string | null; breakEnd?: string | null }) => {
  if (record.breakStart && record.breakEnd) {
    const start = dayjs(`${normalizeDate(record.date)}T${record.breakStart}`);
    const end = dayjs(`${normalizeDate(record.date)}T${record.breakEnd}`);
    if (start.isValid() && end.isValid() && end.isAfter(start)) {
      return end.diff(start, 'minute');
    }
  }
  return undefined;
};

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = readSessionToken(token);

  if (!session || session.role !== 'EMPLOYEE' || !session.employeeId) {
    return NextResponse.json(
      { error: '従業員アカウントでのログインが必要です' },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const action = body?.action as ClockAction | undefined;
  const note = body?.note as string | undefined;

  if (!action) {
    return NextResponse.json(
      { error: 'action を指定してください' },
      { status: 400 },
    );
  }

  const now = dayjs();
  const todayStart = now.startOf('day').toDate();
  const todayEnd = now.endOf('day').toDate();

  let record = await prisma.attendanceRecord.findFirst({
    where: {
      employeeId: session.employeeId,
      date: { gte: todayStart, lte: todayEnd },
    },
  });

  if (!record) {
    record = await prisma.attendanceRecord.create({
      data: {
        employeeId: session.employeeId,
        date: todayStart,
        note,
      },
    });
  }

  if (!record) {
    return NextResponse.json({ error: '打刻レコードを作成できませんでした' }, { status: 500 });
  }

  let currentRecord = record;

  const updateRecord = async (data: Record<string, unknown>) => {
    currentRecord = await prisma.attendanceRecord.update({
      where: { id: currentRecord.id },
      data: { ...data, note: note ?? currentRecord.note },
    });
    return currentRecord;
  };

  if (action === 'clockIn') {
    if (currentRecord.clockIn) {
      return NextResponse.json(
        { error: 'すでに出勤打刻済みです' },
        { status: 409 },
      );
    }
    await updateRecord({ clockIn: now.format('HH:mm') });
  } else if (action === 'clockOut') {
    if (currentRecord.clockOut) {
      return NextResponse.json(
        { error: 'すでに退勤打刻済みです' },
        { status: 409 },
      );
    }
    await updateRecord({ clockOut: now.format('HH:mm') });
  } else if (action === 'breakStart') {
    if (!currentRecord.clockIn) {
      return NextResponse.json(
        { error: '先に出勤打刻をしてください' },
        { status: 400 },
      );
    }
    if (currentRecord.breakStart && !currentRecord.breakEnd) {
      return NextResponse.json(
        { error: 'すでに休憩中です' },
        { status: 409 },
      );
    }
    await updateRecord({
      breakStart: now.format('HH:mm'),
      breakEnd: null,
      breakMinutes: null,
    });
  } else if (action === 'breakEnd') {
    if (!currentRecord.breakStart || currentRecord.breakEnd) {
      return NextResponse.json(
        { error: '休憩開始後に押してください' },
        { status: 400 },
      );
    }
    const minutes = Math.max(
      now.diff(dayjs(`${normalizeDate(currentRecord.date)}T${currentRecord.breakStart}`), 'minute'),
      0,
    );
    await updateRecord({
      breakEnd: now.format('HH:mm'),
      breakMinutes: minutes,
    });
  } else if (action === 'update') {
    const inputClockIn = body?.clockIn as string | undefined;
    const inputClockOut = body?.clockOut as string | undefined;
    const inputBreakStart = body?.breakStart as string | undefined;
    const inputBreakEnd = body?.breakEnd as string | undefined;
    const data: {
      clockIn?: string | null;
      clockOut?: string | null;
      breakStart?: string | null;
      breakEnd?: string | null;
      breakMinutes?: number | null;
      note?: string | null;
    } = {
      note: note ?? record.note,
    };
    if (inputClockIn !== undefined) data.clockIn = inputClockIn || null;
    if (inputClockOut !== undefined) data.clockOut = inputClockOut || null;
    if (inputBreakStart !== undefined) data.breakStart = inputBreakStart || null;
    if (inputBreakEnd !== undefined) data.breakEnd = inputBreakEnd || null;

    // Recalculate breakMinutes if both provided (or existing) are valid
    const patchedRecord = {
      ...currentRecord,
      clockIn: data.clockIn ?? currentRecord.clockIn,
      clockOut: data.clockOut ?? currentRecord.clockOut,
      breakStart: data.breakStart ?? currentRecord.breakStart,
      breakEnd: data.breakEnd ?? currentRecord.breakEnd,
    };
    const computedBreak = calcBreakMinutes({
      date: currentRecord.date,
      breakStart: patchedRecord.breakStart,
      breakEnd: patchedRecord.breakEnd,
    });
    if (computedBreak !== undefined) {
      data.breakMinutes = computedBreak;
    }

    await updateRecord(data);
  } else {
    return NextResponse.json(
      { error: '未対応のアクションです' },
      { status: 400 },
    );
  }

  return NextResponse.json({
    record: {
      ...currentRecord,
      date: normalizeDate(currentRecord.date),
    },
  });
}
