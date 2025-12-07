import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE_NAME, readSessionToken } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json(
      { error: '管理者アカウントでのログインが必要です' },
      { status: 401 },
    );
  }

  const employees = await prisma.employee.findMany({
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ employees });
}
