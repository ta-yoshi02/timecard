import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE_NAME, readSessionToken, hashPassword } from '@/lib/auth';

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
    const { employeeId, loginId, password } = body;

    if (!employeeId || !loginId || !password) {
        return NextResponse.json(
            { error: '必須項目が不足しています' },
            { status: 400 },
        );
    }

    try {
        const user = await prisma.user.create({
            data: {
                loginId,
                passwordHash: hashPassword(password),
                role: 'EMPLOYEE',
                employeeId,
            },
        });

        return NextResponse.json({ user });
    } catch (e) {
        console.error(e);
        return NextResponse.json(
            { error: 'ユーザーの作成に失敗しました。ログインIDが重複している可能性があります。' },
            { status: 500 },
        );
    }
}
