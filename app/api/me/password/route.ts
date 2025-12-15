import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE_NAME, readSessionToken, hashPassword, verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const session = await readSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);

    if (!session) {
        return NextResponse.json(
            { error: 'ログインが必要です' },
            { status: 401 },
        );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
        return NextResponse.json(
            { error: '現在のパスワードと新しいパスワードが必要です' },
            { status: 400 },
        );
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
        });

        if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
            return NextResponse.json(
                { error: '現在のパスワードが正しくありません' },
                { status: 400 },
            );
        }

        await prisma.user.update({
            where: { id: session.userId },
            data: {
                passwordHash: hashPassword(newPassword),
            },
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json(
            { error: 'パスワードの変更に失敗しました' },
            { status: 500 },
        );
    }
}
