import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, safeJson } from '@/lib/current-user';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { encodeBanner, isBannerUrl, MAX_BANNER_BYTES } from '@/lib/banner-image';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!user || user.id !== currentUserId) {
      return NextResponse.json({ error: 'Нет прав на изменение' }, { status: 403 });
    }

    const contentType = request.headers.get('content-type') || '';
    let finalBannerUrl = '';

    // 1. Если передана прямая ссылка через JSON
    if (contentType.includes('application/json')) {
      const body = await request.json();
      if (body.bannerUrl !== null && typeof body.bannerUrl !== 'string') {
        return NextResponse.json({ error: 'Некорректная ссылка' }, { status: 400 });
      }
      finalBannerUrl = (body.bannerUrl || '').trim();
    }
    // 2. Если загружен файл через FormData
    else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const urlField = formData.get('bannerUrl');

      if (typeof urlField === 'string' && urlField.trim()) {
        finalBannerUrl = urlField.trim();
      } else if (file instanceof File && file.size > 0) {
        if (file.size > MAX_BANNER_BYTES) return NextResponse.json({ error: 'Максимальный размер — 10 МБ' }, { status: 413 });
        const bytes = await file.arrayBuffer();
        let buffer: Buffer;
        try {
          buffer = await encodeBanner(Buffer.from(bytes));
        } catch {
          return NextResponse.json({ error: 'Нужен корректный JPEG, PNG или WebP' }, { status: 400 });
        }

        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        const fileName = `banner-${user.id}-${randomUUID()}.webp`;
        const filePath = path.join(uploadDir, fileName);

        await writeFile(filePath, buffer);
        finalBannerUrl = `/uploads/${fileName}`;
      }
    } else {
      return NextResponse.json({ error: 'Неподдерживаемый формат запроса' }, { status: 415 });
    }

    if (finalBannerUrl && !isBannerUrl(finalBannerUrl)) {
      return NextResponse.json({ error: 'Нужна HTTPS-ссылка на изображение' }, { status: 400 });
    }

    if (!finalBannerUrl) {
      // Если ссылка пустая — сбрасываем обложку на стандартную
      await prisma.user.update({
        where: { id: user.id },
        data: { bannerUrl: null },
      });
      return NextResponse.json(safeJson({ success: true, bannerUrl: null }));
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { bannerUrl: finalBannerUrl },
      select: { bannerUrl: true },
    });

    return NextResponse.json(safeJson({ success: true, bannerUrl: updatedUser.bannerUrl }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
