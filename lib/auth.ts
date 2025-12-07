import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

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

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (password: string, hashed: string): boolean => {
  const [salt, key] = hashed.split(':');
  if (!salt || !key) return false;
  const derived = scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== derived.length) return false;
  return timingSafeEqual(derived, keyBuffer);
};

const encodePayload = (payload: SessionUser) =>
  Buffer.from(JSON.stringify(payload)).toString('base64url');

const signPayload = (payload: SessionUser) => {
  const encoded = encodePayload(payload);
  const signature = createHmac('sha256', getSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${signature}`;
};

export const createSessionToken = (
  payload: Omit<SessionUser, 'exp'>,
): string => {
  const exp = Date.now() + SESSION_TTL_SECONDS * 1000;
  return signPayload({ ...payload, exp });
};

export const readSessionToken = (token?: string | null): SessionUser | null => {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expectedSig = createHmac('sha256', getSecret())
    .update(encoded)
    .digest('base64url');
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) {
    return null;
  }

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
