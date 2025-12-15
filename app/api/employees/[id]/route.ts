import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE_NAME, readSessionToken } from '@/lib/auth';

export async function PUT(
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
    const { name, hourlyRate, role } = body;

    try {
        const employee = await prisma.employee.update({
            where: { id },
            data: {
                name,
                hourlyRate: Number(hourlyRate),
                role,
                jobRole: body.jobRole,
            },
        });
        return NextResponse.json({ employee });
    } catch (e) {
        console.error(e);
        return NextResponse.json(
            { error: '更新に失敗しました' },
            { status: 500 },
        );
    }
}

export async function DELETE(
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

    try {
        // Cascade delete is configured in schema for User and AttendanceRecord
        await prisma.employee.delete({
            where: { id },
        });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json(
            { error: '削除に失敗しました' },
            { status: 500 },
        );
    }
}
