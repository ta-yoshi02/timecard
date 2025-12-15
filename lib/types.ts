export type User = {
  id: string;
  loginId: string;
  role: 'ADMIN' | 'EMPLOYEE';
  employeeId?: string | null;
};

export type WageHistory = {
  id: string;
  employeeId: string;
  hourlyRate: number;
  effectiveDate: Date;
};

export type Employee = {
  id: string;
  name: string;
  role: string;
  jobRole: string;
  hourlyRate: number;
  user?: User | null;
  wageHistory?: WageHistory[];
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  clockIn?: string;
  clockOut?: string;
  breakStart?: string;
  breakEnd?: string;
  shiftStart?: string;
  shiftEnd?: string;
  breakMinutes?: number;
  note?: string;
};
