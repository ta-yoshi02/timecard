import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE_NAME, readSessionToken } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = readSessionToken(token);

  if (!session) {
    return NextResponse.json({ user: null });
  }

  const employee = session.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.employeeId } })
    : null;

  return NextResponse.json({
    user: {
      ...session,
      employeeName: session.employeeName ?? employee?.name ?? null,
    },
    employee,
  });
}
