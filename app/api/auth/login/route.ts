import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  createSessionToken,
  verifyPassword,
} from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const loginId = body?.loginId as string | undefined;
  const password = body?.password as string | undefined;

  if (!loginId || !password) {
    return NextResponse.json(
      { error: 'ID とパスワードを入力してください' },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { loginId },
    include: { employee: true },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { error: '認証に失敗しました。IDまたはパスワードを確認してください。' },
      { status: 401 },
    );
  }

  const sessionToken = createSessionToken({
    userId: user.id,
    role: user.role,
    employeeId: user.employeeId ?? undefined,
    employeeName: user.employee?.name ?? null,
  });

  const response = NextResponse.json({
    role: user.role,
    employeeId: user.employeeId ?? null,
    employeeName: user.employee?.name ?? null,
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  });

  return response;
}
