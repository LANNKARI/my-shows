import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "./prisma";
import { premiumActive } from "./premium";
import { CalendarError } from "./calendar-server";
import { encodeBanner, MAX_BANNER_BYTES } from "./banner-image";
export async function uploadProfileBanner(
  bytes: Buffer,
  userId: string,
): Promise<string> {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "episyhub/banners",
        public_id: `${userId}-${randomUUID()}`,
        resource_type: "image",
        format: "webp",
      },
      (error, result) => {
        if (error || !result?.secure_url)
          return reject(
            new CalendarError(
              503,
              "Не удалось сохранить изображение. Попробуйте позже.",
            ),
          );
        resolve(result.secure_url);
      },
    );
    stream.end(bytes);
  });
}
export async function saveProfileBanner(
  userId: string,
  username: string,
  bytes: Buffer | null,
  upload = uploadProfileBanner,
  db = prisma,
) {
  const user = await db.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!user || user.id !== userId)
    throw new CalendarError(403, "Нет прав на изменение");
  if (!(await premiumActive(userId, db)))
    throw new CalendarError(403, "Своя шапка доступна с активным Premium");
  let url: string | null = null;
  if (bytes) {
    if (!bytes.length || bytes.length > MAX_BANNER_BYTES)
      throw new CalendarError(413, "Максимальный размер — 10 МБ");
    let encoded: Buffer;
    try {
      encoded = await encodeBanner(bytes);
    } catch {
      throw new CalendarError(
        400,
        "Не удалось прочитать изображение. Выберите JPEG, PNG или WebP.",
      );
    }
    const bucket = Math.floor(Date.now() / 900000);
    const limit = await db.authRateLimit.upsert({
      where: { key: `banner:${userId}:${bucket}` },
      create: {
        key: `banner:${userId}:${bucket}`,
        count: 1,
        expiresAt: new Date((bucket + 1) * 900000),
      },
      update: { count: { increment: 1 } },
    });
    if (limit.count > 5)
      throw new CalendarError(
        429,
        "Слишком много загрузок. Попробуйте через 15 минут.",
      );
    url = await upload(encoded, userId);
    if (!url.startsWith("https://"))
      throw new CalendarError(503, "Не удалось сохранить изображение");
  }
  await db.$transaction(async (tx) => {
    if (!(await premiumActive(userId, tx)))
      throw new CalendarError(
        403,
        "Подписка завершилась. Продлите Premium, чтобы изменить шапку.",
      );
    await tx.user.update({
      where: { id: userId },
      data: {
        bannerUrl: url,
        profileStyle: "profile-standard",
      },
    });
  });
  return { success: true, bannerUrl: url };
}
