import dayjs from "dayjs";
import { AttendanceRecord, Employee } from "./types";

export type AttendanceIssue =
  | "missingClockIn"
  | "missingClockOut"
  | "overwork"
  | "insufficientBreak"
  | "nightShift";

const DAILY_OVERTIME_THRESHOLD_HOURS = 8;
const WEEKLY_OVERTIME_THRESHOLD_HOURS = 40;
const NIGHT_SHIFT_START_HOUR = 22;
const NIGHT_SHIFT_END_HOUR = 5;
const OVERTIME_RATE_MULTIPLIER = 0.25;
const NIGHT_RATE_MULTIPLIER = 0.25;

const getBreakMinutes = (record: AttendanceRecord) =>
  typeof record.breakMinutes === "number" ? record.breakMinutes : 0;

export const calculateDailyHours = (
  record: AttendanceRecord,
): number | null => {
  if (!record.clockIn || !record.clockOut) return null;
  const start = dayjs(`${record.date}T${record.clockIn}`);
  const end = dayjs(`${record.date}T${record.clockOut}`);
  if (!start.isValid() || !end.isValid()) return null;
  const totalMinutes = end.diff(start, "minute");
  const netMinutes = totalMinutes - getBreakMinutes(record);
  if (netMinutes <= 0) return null;
  return netMinutes / 60;
};

export const detectIssues = (record: AttendanceRecord): AttendanceIssue[] => {
  const issues: AttendanceIssue[] = [];
  if (!record.clockIn) issues.push("missingClockIn");
  if (!record.clockOut) issues.push("missingClockOut");

  const start = record.clockIn ? dayjs(`${record.date}T${record.clockIn}`) : null;
  const end = record.clockOut ? dayjs(`${record.date}T${record.clockOut}`) : null;
  const rawDuration = start && end ? end.diff(start, "minute") : null;
  const breakMinutes = getBreakMinutes(record);

  if (rawDuration !== null) {
    // Break compliance (labor standards)
    if (rawDuration > 8 * 60 && breakMinutes < 60) {
      issues.push("insufficientBreak");
    } else if (rawDuration > 6 * 60 && breakMinutes < 45) {
      issues.push("insufficientBreak");
    }
    // Night shift flag (22:00以降に就業)
    if (end && end.hour() >= NIGHT_SHIFT_START_HOUR) {
      issues.push("nightShift");
    }
  }

  const hours = calculateDailyHours(record);
  if (hours !== null && hours > DAILY_OVERTIME_THRESHOLD_HOURS) {
    issues.push("overwork");
  }
  return issues;
};

const calculateNightMinutes = (
  start: dayjs.Dayjs,
  end: dayjs.Dayjs,
): number => {
  // Window 1: same-day 22:00-24:00, Window 2: next-day 00:00-05:00
  const startDay = start.startOf("day");
  const nightStart = startDay.add(NIGHT_SHIFT_START_HOUR, "hour");
  const midnight = startDay.add(1, "day");
  const nextDayNightEnd = midnight.add(NIGHT_SHIFT_END_HOUR, "hour");

  const overlap = (rangeStart: dayjs.Dayjs, rangeEnd: dayjs.Dayjs) => {
    const s = rangeStart.isAfter(start) ? rangeStart : start;
    const e = rangeEnd.isBefore(end) ? rangeEnd : end;
    return Math.max(e.diff(s, "minute"), 0);
  };

  const window1 = overlap(nightStart, midnight);
  const window2 = overlap(midnight, nextDayNightEnd);
  return window1 + window2;
};

type PayBreakdown = {
  hours: number;
  pay: number;
  overtimeMinutes: number;
  nightMinutes: number;
};

const calculatePay = (
  record: AttendanceRecord,
  hourlyRate: number,
): PayBreakdown => {
  if (!record.clockIn || !record.clockOut) {
    return { hours: 0, pay: 0, overtimeMinutes: 0, nightMinutes: 0 };
  }

  const start = dayjs(`${record.date}T${record.clockIn}`);
  const end = dayjs(`${record.date}T${record.clockOut}`);
  if (!start.isValid() || !end.isValid()) {
    return { hours: 0, pay: 0, overtimeMinutes: 0, nightMinutes: 0 };
  }

  const rawMinutes = end.diff(start, "minute");
  const netMinutes = Math.max(rawMinutes - getBreakMinutes(record), 0);
  if (netMinutes <= 0) return { hours: 0, pay: 0, overtimeMinutes: 0, nightMinutes: 0 };

  const overtimeMinutes = Math.max(0, netMinutes - DAILY_OVERTIME_THRESHOLD_HOURS * 60);
  const nightMinutes = Math.min(netMinutes, calculateNightMinutes(start, end));

  const basePay = (netMinutes / 60) * hourlyRate;
  const overtimePremium = (overtimeMinutes / 60) * hourlyRate * OVERTIME_RATE_MULTIPLIER;
  const nightPremium = (nightMinutes / 60) * hourlyRate * NIGHT_RATE_MULTIPLIER;

  return {
    hours: netMinutes / 60,
    pay: Number((basePay + overtimePremium + nightPremium).toFixed(0)),
    overtimeMinutes,
    nightMinutes,
  };
};

export const isWithinRange = (
  date: string,
  startDate?: Date | null,
  endDate?: Date | null,
): boolean => {
  const current = dayjs(date);
  if (!current.isValid()) return false;
  if (startDate && current.isBefore(dayjs(startDate), "day")) return false;
  if (endDate && current.isAfter(dayjs(endDate), "day")) return false;
  return true;
};

export const filterRecordsByDateRange = (
  records: AttendanceRecord[],
  startDate?: Date | null,
  endDate?: Date | null,
) => records.filter((record) => isWithinRange(record.date, startDate, endDate));

export type EmployeeSummary = {
  employee: Employee;
  records: AttendanceRecord[];
  totalHours: number;
  estimatedPay?: number;
  missingCount: number;
  overworkCount: number;
  latestRecord?: AttendanceRecord;
  issues: AttendanceIssue[];
  monthly: {
    records: AttendanceRecord[];
    totalHours: number;
    estimatedPay?: number;
    missingCount: number;
    overworkCount: number;
    issues: AttendanceIssue[];
    latestRecord?: AttendanceRecord;
    startDate: Date;
    endDate: Date;
  };
};

const countUniqueIssues = (issueLists: AttendanceIssue[][]): AttendanceIssue[] =>
  Array.from(new Set(issueLists.flat()));

const latestByDate = (
  records: AttendanceRecord[],
): AttendanceRecord | undefined => {
  return records
    .slice()
    .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0];
};

const aggregateEmployeeRecords = (
  employee: Employee,
  employeeRecords: AttendanceRecord[],
  applyWeeklyThreshold = true,
) => {
  let totalHours = 0;
  let missingCount = 0;
  let overworkCount = 0;
  let estimatedPay = 0;
  const recordIssues: AttendanceIssue[][] = [];

  employeeRecords.forEach((record) => {
    const issues = detectIssues(record);
    recordIssues.push(issues);
    if (issues.includes("missingClockIn")) missingCount += 1;
    if (issues.includes("missingClockOut")) missingCount += 1;
    if (issues.includes("overwork") || issues.includes("insufficientBreak")) {
      overworkCount += 1;
    }

    const pay = calculatePay(record, employee.hourlyRate);
    totalHours += pay.hours;
    estimatedPay += pay.pay;
  });

  if (applyWeeklyThreshold && totalHours > WEEKLY_OVERTIME_THRESHOLD_HOURS) {
    overworkCount += 1;
    recordIssues.push(["overwork"]);
  }

  return {
    records: employeeRecords,
    totalHours: Number(totalHours.toFixed(1)),
    estimatedPay: Number(estimatedPay.toFixed(0)),
    missingCount,
    overworkCount,
    latestRecord: latestByDate(employeeRecords),
    issues: countUniqueIssues(recordIssues),
  };
};

export type MonthlyRange = {
  start?: Date | null;
  end?: Date | null;
};

export const summarizeEmployees = (
  employees: Employee[],
  records: AttendanceRecord[],
  startDate?: Date | null,
  endDate?: Date | null,
  monthlyRange?: MonthlyRange,
): EmployeeSummary[] => {
  const rangeRecords = filterRecordsByDateRange(records, startDate, endDate);
  const fallbackEnd = endDate ?? startDate ?? getLatestDatasetDate(records) ?? new Date();
  const monthlyBase =
    monthlyRange?.start ?? monthlyRange?.end ?? fallbackEnd;
  const monthlyRangeStart =
    monthlyRange?.start ?? dayjs(monthlyBase).startOf("month").toDate();
  const monthlyRangeEnd =
    monthlyRange?.end ?? dayjs(monthlyBase).endOf("month").toDate();
  const monthlyRecords = filterRecordsByDateRange(
    records,
    monthlyRangeStart,
    monthlyRangeEnd,
  );

  return employees.map((employee) => {
    const employeeRecords = rangeRecords.filter(
      (record) => record.employeeId === employee.id,
    );
    const employeeMonthlyRecords = monthlyRecords.filter(
      (record) => record.employeeId === employee.id,
    );
    const rangeSummary = aggregateEmployeeRecords(employee, employeeRecords);
    const monthlySummary = aggregateEmployeeRecords(
      employee,
      employeeMonthlyRecords,
      false,
    );

    return {
      employee,
      ...rangeSummary,
      monthly: {
        ...monthlySummary,
        startDate: monthlyRangeStart,
        endDate: monthlyRangeEnd,
      },
    };
  });
};

export const getLatestDatasetDate = (
  records: AttendanceRecord[],
): Date | null => {
  if (records.length === 0) return null;
  const latest = records
    .slice()
    .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)))[0];
  return dayjs(latest.date).toDate();
};

export const getEmployeeRecordsWithinDays = (
  employeeId: string,
  records: AttendanceRecord[],
  days: number,
): AttendanceRecord[] => {
  if (records.length === 0) return [];
  const baseDate = getLatestDatasetDate(records);
  if (!baseDate) return [];
  const start = dayjs(baseDate).subtract(days - 1, "day").toDate();
  return filterRecordsByDateRange(records, start, baseDate)
    .filter((record) => record.employeeId === employeeId)
    .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)));
};
