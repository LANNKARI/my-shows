import { createHash, createHmac, timingSafeEqual } from 'crypto';

export type UndoProgress = {
  episodeId: number;
  before: {
    watched: boolean;
    stoppedAt: string | null;
    watchedAt: string | null;
  } | null;
};
export type ProgressUndo = {
  version: 1;
  userId: string;
  userShowId: number;
  expiresAt: number;
  before: { status: string; isCompleted: boolean };
  progress: UndoProgress[];
  fingerprint: string;
};

export function progressFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function signProgressUndo(
  payload: ProgressUndo,
  secret: string,
): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(`progress-undo:v1:${data}`)
    .digest('base64url');
  const token = `${data}.${signature}`;
  if (token.length > 65536) throw new Error('Undo snapshot too large');
  return token;
}

export function verifyProgressUndo(
  token: string,
  secret: string,
  now = Date.now(),
): ProgressUndo | null {
  if (token.length > 65536) return null;
  const [data, signature, extra] = token.split('.');
  if (!data || !signature || extra !== undefined) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(data) || !/^[A-Za-z0-9_-]{43}$/.test(signature))
    return null;
  const expected = createHmac('sha256', secret)
    .update(`progress-undo:v1:${data}`)
    .digest();
  const provided = Buffer.from(signature, 'base64url');
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  )
    return null;
  try {
    const payload = JSON.parse(
      Buffer.from(data, 'base64url').toString('utf8'),
    ) as ProgressUndo;
    return payload.version === 1 &&
      Number.isFinite(payload.expiresAt) &&
      payload.expiresAt > now &&
      Array.isArray(payload.progress)
      ? payload
      : null;
  } catch {
    return null;
  }
}
