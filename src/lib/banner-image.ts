import sharp from 'sharp';

export const MAX_BANNER_BYTES = 10 * 1024 * 1024;

export async function encodeBanner(bytes: Buffer): Promise<Buffer> {
  const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' });
  const metadata = await image.metadata();
  if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
    throw new Error('Разрешены только JPEG, PNG и WebP');
  }
  // Декодируем изображение и создаём новый растровый файл без метаданных.
  return image.rotate().resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
}

export function isBannerUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  if (/^\/uploads\/banner-[a-zA-Z0-9_-]+\.(?:webp|png|jpe?g)$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
