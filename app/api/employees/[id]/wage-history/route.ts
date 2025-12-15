import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SESSION_COOKIE_NAME, readSessionToken } from '@/lib/auth';
import dayjs from 'dayjs';

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
    const { hourlyRate, effectiveDate } = body;

    if (!hourlyRate || !effectiveDate) {
        return NextResponse.json(
            { error: '時給と適用開始月は必須です' },
            { status: 400 },
        );
    }

    // Ensure effectiveDate is the 1st of the month
    const date = dayjs(effectiveDate).startOf('month').toDate();

    try {
        const wageHistory = await prisma.wageHistory.create({
            data: {
                employeeId: id,
                hourlyRate: Number(hourlyRate),
                effectiveDate: date,
            },
        });
        return NextResponse.json({ wageHistory });
    } catch (e) {
        console.error(e);
        return NextResponse.json(
            { error: '時給履歴の作成に失敗しました。同じ月の履歴が既に存在する可能性があります。' },
            { status: 500 },
        );
    }
}
