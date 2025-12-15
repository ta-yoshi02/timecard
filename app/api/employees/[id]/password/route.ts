import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE_NAME, readSessionToken, hashPassword } from '@/lib/auth';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const cookieStore = await cookies();
    const session = await readSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!session || session.role !== 'ADMIN') {
        return NextResponse.json(
            { error: '管理者アカウントでのログインが必要です' },
            { status: 401 },
        );
    }

    const body = await request.json();
    const { password, temp } = body; // temp is boolean, if true generate random password

    let newPassword = password;
    if (temp) {
        // Generate a random 8-character password
        newPassword = Math.random().toString(36).slice(-8);
    }

    if (!newPassword) {
        return NextResponse.json(
            { error: 'パスワードが必要です' },
            { status: 400 },
        );
    }

    try {
        // Find user associated with employee
        const user = await prisma.user.findUnique({
            where: { employeeId: id },
        });

        if (!user) {
            // If no user exists, we might want to create one? 
            // For now, let's assume user exists or return error.
            // Actually, the requirement says "issue temp password (in case they forgot)", implies account exists.
            // But if they don't have an account, we should probably create one or error.
            // Let's error for now, as account creation is separate.
            return NextResponse.json(
                { error: 'この従業員にはログインアカウントがありません' },
                { status: 404 },
            );
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: hashPassword(newPassword),
            },
        });

        return NextResponse.json({ success: true, newPassword: temp ? newPassword : null });
    } catch (e) {
        console.error(e);
        return NextResponse.json(
            { error: 'パスワードリセットに失敗しました' },
            { status: 500 },
        );
    }
}
