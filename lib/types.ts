export type Employee = {
  id: string;
  name: string;
  role: string;
  hourlyRate: number;
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
