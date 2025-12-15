import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { readSessionToken, SESSION_COOKIE_NAME } from './lib/session';
import { generateCsrfSecret, verifyCsrfToken } from './lib/csrf';

export const CSRF_COOKIE_NAME = 'csrf_secret';
export const CSRF_HEADER_NAME = 'X-CSRF-Token';

export async function proxy(request: NextRequest) {
    const response = NextResponse.next();

    // =========================================================================
    // 1. CSRF Protection (Global)
    // =========================================================================

    // Ensure CSRF secret cookie exists
    let secret = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    if (!secret) {
        secret = generateCsrfSecret();
        response.cookies.set(CSRF_COOKIE_NAME, secret, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
        });
    }

    // Verify CSRF token on mutation requests
    const method = request.method;
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        const token = request.headers.get(CSRF_HEADER_NAME);

        // Enforce CSRF on all API routes
        if (request.nextUrl.pathname.startsWith('/api/')) {
            if (!token || !secret || !verifyCsrfToken(token, secret)) {
                return NextResponse.json(
                    { error: 'Invalid CSRF token' },
                    { status: 403 }
                );
            }
        }
    }

    // =========================================================================
    // 2. Authentication & Authorization (Protected Routes)
    // =========================================================================

    const protectedPaths = ['/my', '/employees'];
    const isProtected = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));

    if (isProtected) {
        const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
        const session = await readSessionToken(token);

        if (!session) {
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('from', request.nextUrl.pathname);
            return NextResponse.redirect(loginUrl);
        }

        // Role based protection
        if (request.nextUrl.pathname.startsWith('/employees')) {
            if (session.role !== 'ADMIN') {
                return NextResponse.redirect(new URL('/my', request.url));
            }
        }
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
