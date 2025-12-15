import { randomBytes, createHmac, timingSafeEqual } from 'crypto';

// Secret for signing CSRF tokens. In production, this should be a long random string.
// We can reuse AUTH_SECRET or have a separate CSRF_SECRET.
const CSRF_SECRET = process.env.AUTH_SECRET || 'csrf-secret-key';

export const generateCsrfSecret = (): string => {
    return randomBytes(32).toString('hex');
};

export const generateCsrfToken = (secret: string): string => {
    const salt = randomBytes(8).toString('hex');
    const hash = createHmac('sha256', CSRF_SECRET)
        .update(`${salt}-${secret}`)
        .digest('hex');
    return `${salt}:${hash}`;
};

export const verifyCsrfToken = (token: string, secret: string): boolean => {
    const [salt, hash] = token.split(':');
    if (!salt || !hash) return false;

    const expectedHash = createHmac('sha256', CSRF_SECRET)
        .update(`${salt}-${secret}`)
        .digest('hex');

    const expectedBuffer = Buffer.from(expectedHash);
    const actualBuffer = Buffer.from(hash);

    if (expectedBuffer.length !== actualBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, actualBuffer);
};
