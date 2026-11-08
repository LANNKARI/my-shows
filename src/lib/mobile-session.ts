import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "./prisma";

// Reuse Auth.js' otherwise unused database Session table (web sessions are JWT).
// Raw bearer tokens never enter the database; this namespace cannot match web cookies.
const prefix = "mobile:";
const lifetime = 30 * 24 * 60 * 60 * 1000;
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const passwordVersion = (hash: string | null) => digest(hash || "no-password");
export function mobileTokenHash(token: string) {
  return /^ehm_[A-Za-z0-9_-]{43}$/.test(token) ? prefix + digest(token) : null;
}
export function bearerToken(authorization: string | null) {
  return authorization?.match(/^Bearer (ehm_[A-Za-z0-9_-]{43})$/i)?.[1] || null;
}
export async function createMobileSession(
  userId: string,
  passwordHash: string,
) {
  const token = `ehm_${randomBytes(32).toString("base64url")}`;
  const expires = new Date(Date.now() + lifetime);
  await prisma.session.create({
    data: {
      id: `${randomUUID()}.${passwordVersion(passwordHash)}`,
      userId,
      sessionToken: mobileTokenHash(token)!,
      expires,
    },
  });
  return { token, expiresAt: expires.toISOString() };
}
export async function mobileSession(authorization: string | null) {
  const token = bearerToken(authorization);
  const hash = token && mobileTokenHash(token);
  if (!hash) return null;
  const session = await prisma.session.findUnique({
    where: { sessionToken: hash },
    include: { user: { select: { id: true, passwordHash: true } } },
  });
  if (!session || session.expires.getTime() <= Date.now()) return null;
  // Password changes invalidate sessions without changing the existing web login.
  if (!session.id.endsWith(`.${passwordVersion(session.user.passwordHash)}`))
    return null;
  return { userId: session.userId, expiresAt: session.expires.toISOString() };
}
export async function revokeMobileSession(authorization: string | null) {
  const token = bearerToken(authorization);
  const hash = token && mobileTokenHash(token);
  if (hash) await prisma.session.deleteMany({ where: { sessionToken: hash } });
}
