export type SessionUser = {
    userId: string;
    role: 'ADMIN' | 'EMPLOYEE';
    employeeId?: string;
    employeeName?: string | null;
    exp: number;
};

export const SESSION_COOKIE_NAME = 'tc_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 1; // 1 hour

const getSecret = () => process.env.AUTH_SECRET || 'dev-secret';

// Web Crypto API helpers
const getKey = async () => {
    const secret = getSecret();
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    return crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
    );
};

const sign = async (data: string): Promise<string> => {
    const key = await getKey();
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(data),
    );
    return Buffer.from(signature).toString('base64url');
};

const verify = async (data: string, signature: string): Promise<boolean> => {
    const key = await getKey();
    const encoder = new TextEncoder();
    const signatureBuffer = Buffer.from(signature, 'base64url');
    return crypto.subtle.verify(
        'HMAC',
        key,
        signatureBuffer,
        encoder.encode(data),
    );
};

const encodePayload = (payload: SessionUser) =>
    Buffer.from(JSON.stringify(payload)).toString('base64url');

export const createSessionToken = async (
    payload: Omit<SessionUser, 'exp'>,
): Promise<string> => {
    const exp = Date.now() + SESSION_TTL_SECONDS * 1000;
    const fullPayload = { ...payload, exp };
    const encoded = encodePayload(fullPayload);
    const signature = await sign(encoded);
    return `${encoded}.${signature}`;
};

export const readSessionToken = async (token?: string | null): Promise<SessionUser | null> => {
    if (!token) return null;
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;

    const isValid = await verify(encoded, signature);
    if (!isValid) return null;

    try {
        const payload = JSON.parse(
            Buffer.from(encoded, 'base64url').toString(),
        ) as SessionUser;
        if (!payload?.exp || Date.now() > payload.exp) return null;
        return payload;
    } catch (e) {
        console.error('Failed to parse session payload', e);
        return null;
    }
};
