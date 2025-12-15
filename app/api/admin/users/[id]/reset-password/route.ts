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
    const { password } = body;

    if (!password) {
        return NextResponse.json(
            { error: '新しいパスワードが必要です' },
            { status: 400 },
        );
    }

    try {
        // id param is the User ID, not Employee ID, based on path structure
        // But wait, the plan said /api/admin/users/[id]/reset-password
        // Let's assume [id] is User ID.
        await prisma.user.update({
            where: { id },
            data: {
                passwordHash: hashPassword(password),
            },
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json(
            { error: 'パスワードのリセットに失敗しました' },
            { status: 500 },
        );
    }
}
