import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import dayjs from 'dayjs';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE_NAME, readSessionToken } from '@/lib/auth';

const normalizeDate = (date: Date | string) => dayjs(date).format('YYYY-MM-DD');

type ClockAction = 'clockIn' | 'clockOut' | 'breakStart' | 'breakEnd' | 'update' | 'create';



export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionToken(token);

  if (!session) {
    return NextResponse.json(
      { error: 'ログインが必要です' },
      { status: 401 },
    );
  }

  if (!session.employeeId && session.role !== 'ADMIN') {
    return NextResponse.json(
      { error: '従業員アカウントでのログインが必要です' },
      { status: 401 },
    );
  }

  if (session.role !== 'EMPLOYEE' && session.role !== 'ADMIN') {
    return NextResponse.json(
      { error: '権限がありません' },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const action = body?.action as ClockAction | undefined;
  const note = body?.note as string | undefined;
  const clientTime = body?.clientTime as string | undefined;

  if (!action) {
    return NextResponse.json(
      { error: 'action を指定してください' },
      { status: 400 },
    );
  }

  const recordId = body?.recordId as string | undefined;

  // Use client time if provided, otherwise fallback to server time
  const now = clientTime ? dayjs(clientTime) : dayjs();
  const todayStart = now.startOf('day').toDate();
  const todayEnd = now.endOf('day').toDate();

  let record: {
    id: string;
    employeeId: string;
    date: Date;
    clockIn: string | null;
    clockOut: string | null;
    breakStart: string | null;
    breakEnd: string | null;
    shiftStart: string | null;
    shiftEnd: string | null;
    breakMinutes: number | null;
    note: string | null;
  } | null = null;

  if (action === 'update' && recordId) {
    record = await prisma.attendanceRecord.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      return NextResponse.json(
        { error: '指定された記録が見つかりません' },
        { status: 404 },
      );
    }

    // Verify ownership or ADMIN role
    if (record.employeeId !== session.employeeId && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '権限がありません' },
        { status: 403 },
      );
    }
  }

  if (action === 'create') {
    const targetDateStr = body?.date as string | undefined;
    if (!targetDateStr) {
      return NextResponse.json(
        { error: '日付を指定してください' },
        { status: 400 },
      );
    }
    const targetDate = dayjs(targetDateStr).startOf('day');
    if (!targetDate.isValid()) {
      return NextResponse.json(
        { error: '無効な日付です' },
        { status: 400 },
      );
    }

    // Determine target employee ID
    let targetEmployeeId = session.employeeId;
    if (session.role === 'ADMIN' && body?.employeeId) {
      targetEmployeeId = body.employeeId;
    }

    if (!targetEmployeeId) {
      return NextResponse.json(
        { error: '従業員IDが特定できません' },
        { status: 400 },
      );
    }

    // Check if record already exists
    const existing = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId: targetEmployeeId,
        date: {
          gte: targetDate.toDate(),
          lte: targetDate.endOf('day').toDate(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: '指定された日付の記録は既に存在します' },
        { status: 409 },
      );
    }

    // Create record
    const inputClockIn = body?.clockIn as string | undefined;
    const inputClockOut = body?.clockOut as string | undefined;
    const inputBreakStart = body?.breakStart as string | undefined;
    const inputBreakEnd = body?.breakEnd as string | undefined;

    // Basic validation for times if provided?
    // Let's reuse the update logic or just create and then update?
    // Creating with initial data is cleaner.

    let breakMinutes: number | null = null;
    if (inputBreakStart && inputBreakEnd) {
      const parseTimeStr = (date: Date, timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        return dayjs(date).startOf('day').add(h, 'hour').add(m, 'minute');
      };
      const start = parseTimeStr(targetDate.toDate(), inputBreakStart);
      const end = parseTimeStr(targetDate.toDate(), inputBreakEnd);
      if (start.isValid() && end.isValid() && end.isAfter(start)) {
        breakMinutes = end.diff(start, 'minute');
      }
    }

    record = await prisma.attendanceRecord.create({
      data: {
        employeeId: targetEmployeeId,
        date: targetDate.toDate(),
        clockIn: inputClockIn || null,
        clockOut: inputClockOut || null,
        breakStart: inputBreakStart || null,
        breakEnd: inputBreakEnd || null,
        breakMinutes: breakMinutes ?? 0,
        note: note || null,
      },
    });

    return NextResponse.json({
      record: {
        ...record,
        date: normalizeDate(record.date),
      },
    });
  }

  if (!record) {
    if (!session.employeeId) {
      return NextResponse.json(
        { error: '従業員情報が見つかりません' },
        { status: 400 },
      );
    }

    record = await prisma.attendanceRecord.findFirst({
      where: {
        employeeId: session.employeeId,
        date: { gte: todayStart, lte: todayEnd },
      },
    });
  }

  // Overnight shift logic:
  // If no record for today, and action is one that continues a shift,
  // check if there is an active record from yesterday.
  if (!record && ['clockOut', 'breakStart', 'breakEnd'].includes(action)) {
    if (session.employeeId) {
      const yesterday = now.subtract(1, 'day');
      const yesterdayStart = yesterday.startOf('day').toDate();
      const yesterdayEnd = yesterday.endOf('day').toDate();

      const yesterdayRecord = await prisma.attendanceRecord.findFirst({
        where: {
          employeeId: session.employeeId,
          date: { gte: yesterdayStart, lte: yesterdayEnd },
          clockIn: { not: null },
          clockOut: null, // Still active
        },
      });

      if (yesterdayRecord) {
        record = yesterdayRecord;
      }
    }
  }

  if (!record && action !== 'clockIn') {
    // If still no record and not clocking in, we can't proceed for some actions
    // But wait, the original code created a record if not found.
    // However, for clockOut/breakStart/breakEnd, we usually expect a record.
    // The original code:
    /*
    if (!record) {
       record = await prisma.attendanceRecord.create(...)
    }
    */
    // We should probably keep the creation logic ONLY if it's clockIn or if we want to allow creating records for today implicitly?
    // Original code created it indiscriminately. Let's stick to that for 'today' if we didn't find a 'yesterday' record.
  }

  if (!record) {
    if (!session.employeeId) {
      return NextResponse.json(
        { error: '従業員情報が見つかりません' },
        { status: 400 },
      );
    }
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

  // Helper to format time, handling 24+ hours for overnight shifts
  const formatTime = (targetTime: dayjs.Dayjs) => {
    const recordDate = dayjs(currentRecord.date).startOf('day');
    const targetDate = targetTime.startOf('day');

    if (targetDate.isAfter(recordDate)) {
      const daysDiff = targetDate.diff(recordDate, 'day');
      const hours = targetTime.hour() + (24 * daysDiff);
      return `${hours}:${targetTime.format('mm')}`;
    }
    return targetTime.format('HH:mm');
  };

  const timeStr = formatTime(now);

  if (action === 'clockIn') {
    if (currentRecord.clockIn) {
      return NextResponse.json(
        { error: 'すでに出勤打刻済みです' },
        { status: 409 },
      );
    }
    await updateRecord({ clockIn: timeStr });
  } else if (action === 'clockOut') {
    if (currentRecord.clockOut) {
      return NextResponse.json(
        { error: 'すでに退勤打刻済みです' },
        { status: 409 },
      );
    }
    await updateRecord({ clockOut: timeStr });
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
      breakStart: timeStr,
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

    // Calculate minutes. 
    // Need to handle 24+ hour format in breakStart if it exists? 
    // Actually, breakStart is stored as string "HH:mm" or "26:mm".
    // Parsing "26:00" with dayjs might be tricky.
    // Better to reconstruct the full datetime for diffing.

    const parseTimeStr = (date: Date, timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      return dayjs(date).startOf('day').add(h, 'hour').add(m, 'minute');
    };

    const breakStartTime = parseTimeStr(currentRecord.date, currentRecord.breakStart);
    const minutes = Math.max(
      now.diff(breakStartTime, 'minute'),
      0,
    );
    await updateRecord({
      breakEnd: timeStr,
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

    if (patchedRecord.clockIn && patchedRecord.clockOut) {
      const parseTimeStr = (date: Date, timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        return dayjs(date).startOf('day').add(h, 'hour').add(m, 'minute');
      };
      const start = parseTimeStr(currentRecord.date, patchedRecord.clockIn);
      const end = parseTimeStr(currentRecord.date, patchedRecord.clockOut);

      if (end.isBefore(start)) {
        return NextResponse.json(
          { error: '退勤時間は出勤時間より後である必要があります' },
          { status: 400 },
        );
      }

      if (patchedRecord.breakStart && patchedRecord.breakEnd) {
        const breakStart = parseTimeStr(currentRecord.date, patchedRecord.breakStart);
        const breakEnd = parseTimeStr(currentRecord.date, patchedRecord.breakEnd);

        if (end.isAfter(breakStart) && end.isBefore(breakEnd)) {
          return NextResponse.json(
            { error: '休憩時間中に退勤することはできません' },
            { status: 400 },
          );
        }

        // Also ensure break is within shift? 
        // User only asked for clockOut not in break.
        // But logically clockOut should be >= breakEnd usually.
        // If clockOut is before breakStart, it's fine (break didn't happen in that shift? but record says it did).
        // If clockOut is exactly breakStart or breakEnd?
        // "Within" usually means strictly inside.
        // If I clock out AT break start, did I take the break? No.
        // If I clock out AT break end, I finished break and immediately clocked out.

        // Let's stick to strict "within" for now, or maybe inclusive?
        // "退勤時間を休憩時間内に行うことができない" -> Cannot do clock-out inside break time.
        // So breakStart < clockOut < breakEnd.
      }
    }

    // We need a robust calcBreakMinutes that handles 24+ hours
    // But for now, let's assume the existing one works OR we need to update it?
    // The existing calcBreakMinutes uses:
    // dayjs(`${normalizeDate(record.date)}T${record.breakStart}`)
    // This will FAIL for "26:00".

    // We should update calcBreakMinutes logic inline or helper
    if (patchedRecord.breakStart && patchedRecord.breakEnd) {
      const parseTimeStr = (date: Date, timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        return dayjs(date).startOf('day').add(h, 'hour').add(m, 'minute');
      };
      const start = parseTimeStr(currentRecord.date, patchedRecord.breakStart);
      const end = parseTimeStr(currentRecord.date, patchedRecord.breakEnd);

      if (start.isValid() && end.isValid() && end.isAfter(start)) {
        data.breakMinutes = end.diff(start, 'minute');
      }
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
