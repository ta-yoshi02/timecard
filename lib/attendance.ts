import date from "@/lib/date";
import type { Dayjs } from "dayjs";
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

export const isValidTimeFormat = (timeStr: string): boolean => {
  return /^([0-4]?[0-9]):[0-5][0-9]$/.test(timeStr);
};

export const parseTime = (dateStr: string, timeStr: string) => {
  const [h, m] = timeStr.split(":").map(Number);
  return date(dateStr).startOf("day").add(h, "hour").add(m, "minute");
};

const getBreakMinutes = (record: AttendanceRecord) => {
  if (typeof record.breakMinutes === "number") return record.breakMinutes;
  if (record.breakStart && record.breakEnd) {
    // Validate format before parsing to avoid invalid date issues if upstream validation missed it
    if (!isValidTimeFormat(record.breakStart) || !isValidTimeFormat(record.breakEnd)) return 0;

    const start = parseTime(record.date, record.breakStart);
    const end = parseTime(record.date, record.breakEnd);
    if (start.isValid() && end.isValid() && end.isAfter(start)) {
      return end.diff(start, "minute");
    }
  }
  return 0;
};

export const calculateDailyHours = (
  record: AttendanceRecord,
): number | null => {
  if (!record.clockIn || !record.clockOut) return null;
  const start = parseTime(record.date, record.clockIn);
  const end = parseTime(record.date, record.clockOut);
  if (!start.isValid() || !end.isValid()) return null;
  const totalMinutes = end.diff(start, "minute");
  const netMinutes = totalMinutes - getBreakMinutes(record);
  if (netMinutes <= 0) return null;
  return netMinutes / 60;
};

const calculateNightMinutes = (
  start: Dayjs,
  end: Dayjs,
): number => {
  // Window 1: same-day 22:00-24:00, Window 2: next-day 00:00-05:00
  // Note: start/end are full Date objects now, so we can compare directly against windows relative to the start date
  const startDay = start.startOf("day");
  const nightStart = startDay.add(NIGHT_SHIFT_START_HOUR, "hour");
  const midnight = startDay.add(1, "day");
  const nextDayNightEnd = midnight.add(NIGHT_SHIFT_END_HOUR, "hour");

  // If the shift is very long (e.g. 48h), this simple logic might fail, but for < 48h it's okay.
  // We can just iterate days if needed, but for now let's stick to the original logic's scope, just fixed for >24h inputs.
  // Actually, if input is 26:00, that is 02:00 next day.
  // The original logic used:
  // window1 = overlap(nightStart, midnight)
  // window2 = overlap(midnight, nextDayNightEnd)
  // This covers 22:00 - 05:00 (next day).
  // If a shift goes to 29:00 (05:00 next day), it works.
  // If a shift goes to 30:00 (06:00 next day), it stops counting at 05:00. Correct.

  const overlap = (rangeStart: Dayjs, rangeEnd: Dayjs) => {
    const s = rangeStart.isAfter(start) ? rangeStart : start;
    const e = rangeEnd.isBefore(end) ? rangeEnd : end;
    return Math.max(e.diff(s, "minute"), 0);
  };

  const window1 = overlap(nightStart, midnight);
  const window2 = overlap(midnight, nextDayNightEnd);
  return window1 + window2;
};

export const detectIssues = (record: AttendanceRecord): AttendanceIssue[] => {
  const issues: AttendanceIssue[] = [];
  if (!record.clockIn) issues.push("missingClockIn");
  if (!record.clockOut) issues.push("missingClockOut");

  const start = record.clockIn ? parseTime(record.date, record.clockIn) : null;
  const end = record.clockOut ? parseTime(record.date, record.clockOut) : null;
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
    if (start && end && calculateNightMinutes(start, end) > 0) {
      issues.push("nightShift");
    }
  }

  const hours = calculateDailyHours(record);
  if (hours !== null && hours > DAILY_OVERTIME_THRESHOLD_HOURS) {
    issues.push("overwork");
  }
  return issues;
};

type PayBreakdown = {
  hours: number;
  pay: number;
  overtimeMinutes: number;
  nightMinutes: number;
};

export const calculatePay = (
  record: AttendanceRecord,
  hourlyRate: number,
): PayBreakdown => {
  if (!record.clockIn || !record.clockOut) {
    return { hours: 0, pay: 0, overtimeMinutes: 0, nightMinutes: 0 };
  }

  const start = parseTime(record.date, record.clockIn);
  const end = parseTime(record.date, record.clockOut);
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
  dateStr: string,
  startDate?: Date | null,
  endDate?: Date | null,
): boolean => {
  const current = date(dateStr);
  if (!current.isValid()) return false;
  if (startDate && current.isBefore(date(startDate), "day")) return false;
  if (endDate && current.isAfter(date(endDate), "day")) return false;
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
    .sort((a, b) => date(b.date).diff(date(a.date)))[0];
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
    monthlyRange?.start ?? date(monthlyBase).startOf("month").toDate();
  const monthlyRangeEnd =
    monthlyRange?.end ?? date(monthlyBase).endOf("month").toDate();
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
    .sort((a, b) => date(b.date).diff(date(a.date)))[0];
  return date(latest.date).toDate();
};

export const getEmployeeRecordsWithinDays = (
  employeeId: string,
  records: AttendanceRecord[],
  days: number,
): AttendanceRecord[] => {
  if (records.length === 0) return [];
  const baseDate = getLatestDatasetDate(records);
  if (!baseDate) return [];
  const start = date(baseDate).subtract(days - 1, "day").toDate();
  return filterRecordsByDateRange(records, start, baseDate)
    .filter((record) => record.employeeId === employeeId)
    .sort((a, b) => date(b.date).diff(date(a.date)));
};
