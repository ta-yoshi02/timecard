import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { readSessionToken, SESSION_COOKIE_NAME } from './lib/session';

export async function middleware(request: NextRequest) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = await readSessionToken(token);

    if (!session) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('from', request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Optional: Role based protection if needed
    // e.g. /employees is for ADMIN only?
    // Current app seems to allow employees to see /employees?
    // Let's check the layout or page.
    // /employees seems to be for Admin?
    // app/employees/page.tsx likely has useRequireRole('ADMIN')?

    // For now, just basic authentication check is enough to prevent "flash".
    // The client-side role check can still exist for fine-grained control,
    // or I can add it here.

    // If I want to protect /employees for ADMIN only:
    if (request.nextUrl.pathname.startsWith('/employees')) {
        if (session.role !== 'ADMIN') {
            // Redirect to /my or show 403?
            // Let's redirect to /my for now as a safe fallback
            return NextResponse.redirect(new URL('/my', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/my/:path*', '/employees/:path*'],
};
