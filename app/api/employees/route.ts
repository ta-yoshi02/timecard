import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE_NAME, readSessionToken } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json(
      { error: '管理者アカウントでのログインが必要です' },
      { status: 401 },
    );
  }

  const employees = await prisma.employee.findMany({
    orderBy: { name: 'asc' },
    include: { user: true },
  });
  return NextResponse.json({ employees });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json(
      { error: '管理者アカウントでのログインが必要です' },
      { status: 401 },
    );
  }

  const body = await request.json();
  const { name, hourlyRate, role, loginId, password } = body;

  if (!name || !hourlyRate || !role) {
    return NextResponse.json(
      { error: '必須項目が不足しています' },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          name,
          hourlyRate: Number(hourlyRate),
          role,
          jobRole: body.jobRole || 'STAFF',
        },
      });

      if (loginId && password) {
        const { hashPassword } = await import('@/lib/auth');
        await tx.user.create({
          data: {
            loginId,
            passwordHash: hashPassword(password),
            role: 'EMPLOYEE',
            employeeId: employee.id,
          },
        });
      }

      return employee;
    });

    return NextResponse.json({ employee: result });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: '従業員の作成に失敗しました。ログインIDが重複している可能性があります。' },
      { status: 500 },
    );
  }
}
