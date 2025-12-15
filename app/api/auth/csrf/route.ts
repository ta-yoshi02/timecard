import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { CSRF_COOKIE_NAME } from '@/proxy';
import { generateCsrfToken } from '@/lib/csrf';

export async function GET() {
    const cookieStore = await cookies();
    const secret = cookieStore.get(CSRF_COOKIE_NAME)?.value;

    if (!secret) {
        return NextResponse.json(
            { error: 'CSRF cookie not found' },
            { status: 400 }
        );
    }

    const token = generateCsrfToken(secret);
    return NextResponse.json({ token });
}
