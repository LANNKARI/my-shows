import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { credit } from "./popcorn-economy";
import {
  EmailError,
  emailConfiguration,
  sendVerificationEmail,
} from "./email-sender";
export class VerificationError extends Error {
  constructor(
    public status: number,
    message: string,
    public pending = false,
  ) {
    super(message);
  }
}
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const normalizedEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";
export function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  url.host = request.headers.get("host") || url.host;
  if (origin && origin !== url.origin)
    throw new VerificationError(403, "Недопустимый источник запроса");
}
export async function emailRateLimit(
  scope: string,
  target: string,
  maximum: number,
  windowMs: number,
) {
  const now = new Date(),
    expires = new Date(now.getTime() + windowMs),
    key = tokenHash(`${scope}:${target}`);
  const [row] = await prisma.$queryRaw<
    { count: number }[]
  >`INSERT INTO "AuthRateLimit" ("key","count","expiresAt") VALUES (${key},1,${expires}) ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "AuthRateLimit"."expiresAt"<=${now} THEN 1 ELSE LEAST("AuthRateLimit"."count"+1,${maximum + 1}) END,"expiresAt"=CASE WHEN "AuthRateLimit"."expiresAt"<=${now} THEN ${expires} ELSE "AuthRateLimit"."expiresAt" END RETURNING "count"`;
  if (row.count > maximum)
    throw new VerificationError(
      429,
      "Слишком много попыток. Попробуйте позже.",
    );
}
export async function registrationIpLimit(
  request: Request,
  scope: string,
  maximum: number,
) {
  const ip = process.env.VERCEL
    ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "local";
  await emailRateLimit(scope, ip, maximum, 15 * 60000);
}
export async function startRegistration(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new VerificationError(400, "Некорректные данные");
  const fields = body as Record<string, unknown>;
  const email = normalizedEmail(fields.email),
    username =
      typeof fields.username === "string"
        ? fields.username.trim().toLowerCase()
        : "";
  const password = fields.password,
    name = typeof fields.name === "string" ? fields.name.trim() || null : null;
  if (
    !validEmail(email) ||
    !/^[a-z0-9_]{3,20}$/.test(username) ||
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72 ||
    (name?.length || 0) > 80
  )
    throw new VerificationError(
      400,
      "Проверьте почту и имя пользователя. Пароль: от 8 символов, не более 72 байт UTF-8.",
    );
  if (!name) throw new VerificationError(400, "Укажите имя");
  if (fields.confirmPassword !== password)
    throw new VerificationError(400, "Пароли не совпадают");
  if (fields.consent !== true)
    throw new VerificationError(400, "Необходимо согласие с пользовательским соглашением и политикой конфиденциальности");
  emailConfiguration();
  const now = new Date();
  await prisma.pendingRegistration.deleteMany({
    where: { expiresAt: { lte: now } },
  });
  await prisma.authRateLimit.deleteMany({ where: { expiresAt: { lte: now } } });
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { id: true },
  });
  if (existing)
    throw new VerificationError(
      409,
      "Почта или имя пользователя уже используются. Войдите в аккаунт или выберите другие данные.",
    );
  const pending = await prisma.pendingRegistration.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true },
  });
  if (pending)
    throw new VerificationError(
      409,
      pending.email === email
        ? "На эту почту уже отправлялась ссылка. Используйте повторную отправку."
        : "Это имя пользователя ожидает подтверждения. Выберите другое.",
      pending.email === email,
    );
  await emailRateLimit("verification-email", email, 5, 3600000);
  const token = randomBytes(32).toString("hex");
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    await prisma.pendingRegistration.create({
      data: {
        email,
        username,
        name,
        passwordHash,
        tokenHash: tokenHash(token),
        sentAt: now,
        expiresAt: new Date(now.getTime() + 86400000),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new VerificationError(
        409,
        "Регистрация уже ожидает подтверждения. Проверьте почту.",
        true,
      );
    throw error;
  }
  try {
    await sendVerificationEmail(email, token);
  } catch (error) {
    await prisma.pendingRegistration.updateMany({
      where: { email, tokenHash: tokenHash(token) },
      data: { sentAt: new Date(0) },
    });
    throw new VerificationError(
      503,
      `${error instanceof EmailError ? error.message : "Не удалось отправить письмо."} Данные сохранены, попробуйте повторную отправку.`,
      true,
    );
  }
}
export async function resendVerification(email: string) {
  if (!validEmail(email))
    throw new VerificationError(400, "Введите корректную почту");
  emailConfiguration();
  await emailRateLimit("verification-email", email, 5, 3600000);
  const before = await prisma.pendingRegistration.findUnique({
    where: { email },
  });
  if (!before || before.sentAt.getTime() > Date.now() - 60000) return;
  const token = randomBytes(32).toString("hex"),
    hash = tokenHash(token),
    now = new Date();
  const updated = await prisma.pendingRegistration.updateMany({
    where: { email, tokenHash: before.tokenHash, sentAt: before.sentAt },
    data: {
      tokenHash: hash,
      sentAt: now,
      expiresAt: new Date(now.getTime() + 86400000),
    },
  });
  if (!updated.count) return;
  try {
    await sendVerificationEmail(email, token);
  } catch (error) {
    await prisma.pendingRegistration.updateMany({
      where: { email, tokenHash: hash },
      data: {
        tokenHash: before.tokenHash,
        sentAt: before.sentAt,
        expiresAt: before.expiresAt,
      },
    });
    throw new VerificationError(
      503,
      error instanceof EmailError
        ? error.message
        : "Не удалось отправить письмо. Попробуйте позже.",
    );
  }
}
export async function confirmRegistration(token: unknown) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw new VerificationError(
      400,
      "Ссылка недействительна или устарела. Запросите новое письмо.",
    );
  const hash = tokenHash(token);
  return prisma.$transaction(async (tx) => {
    const pending = await tx.pendingRegistration.findUnique({
      where: { tokenHash: hash },
    });
    if (!pending || pending.expiresAt.getTime() <= Date.now())
      throw new VerificationError(
        400,
        "Ссылка недействительна или устарела. Запросите новое письмо.",
      );
    const consumed = await tx.pendingRegistration.deleteMany({
      where: {
        email: pending.email,
        tokenHash: hash,
        expiresAt: { gt: new Date() },
      },
    });
    if (!consumed.count)
      throw new VerificationError(
        400,
        "Ссылка уже использована. Попробуйте войти.",
      );
    const user = await tx.user.create({
      data: {
        email: pending.email,
        username: pending.username,
        passwordHash: pending.passwordHash,
        name: pending.name,
        emailVerified: new Date(),
      },
      select: { id: true },
    });
    await credit(
      tx,
      user.id,
      "welcome",
      "welcome",
      100,
      "Подарок новому пользователю",
    );
    return user.id;
  });
}
