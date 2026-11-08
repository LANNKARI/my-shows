import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  createMobileSession,
  mobileSession,
  revokeMobileSession,
} from "@/lib/mobile-session";
import {
  emailRateLimit,
  normalizedEmail,
  registrationIpLimit,
  sameOrigin,
  validEmail,
  VerificationError,
} from "@/lib/email-verification";
import {
  verificationFailure,
  verificationJson,
} from "@/lib/verification-response";

export const runtime = "nodejs";
const userSelect = {
  id: true,
  username: true,
  name: true,
  avatarUrl: true,
} as const;
// A valid fixed bcrypt hash keeps unknown-account checks comparable to real logins.
const dummyHash =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await registrationIpLimit(request, "mobile-login-ip", 40);
    const body = await request.json().catch(() => null);
    const email = normalizedEmail(body?.email);
    const password = body?.password;
    if (
      !validEmail(email) ||
      typeof password !== "string" ||
      !password ||
      Buffer.byteLength(password, "utf8") > 72
    )
      throw new VerificationError(400, "Введите почту и пароль");
    await emailRateLimit("mobile-login-email", email, 10, 15 * 60000);
    const user = await prisma.user.findUnique({
      where: { email },
      select: { ...userSelect, passwordHash: true },
    });
    const valid = await bcrypt.compare(
      password,
      user?.passwordHash || dummyHash,
    );
    if (!user?.passwordHash || !valid)
      throw new VerificationError(
        401,
        "Неверная почта или пароль. Если вы только зарегистрировались, подтвердите почту.",
      );
    const session = await createMobileSession(user.id, user.passwordHash);
    return verificationJson({
      ...session,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    return verificationFailure(error);
  }
}

export async function GET(request: Request) {
  try {
    const session = await mobileSession(request.headers.get("authorization"));
    if (!session) return verificationJson({ error: "Войдите в аккаунт" }, 401);
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: userSelect,
    });
    if (!user) return verificationJson({ error: "Войдите в аккаунт" }, 401);
    return verificationJson({ user, expiresAt: session.expiresAt });
  } catch (error) {
    return verificationFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    await revokeMobileSession(request.headers.get("authorization"));
    return verificationJson({ success: true });
  } catch (error) {
    return verificationFailure(error);
  }
}
