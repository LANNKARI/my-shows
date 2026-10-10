import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, safeJson } from '@/lib/current-user';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const currentUserId = await getCurrentUserId();

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
      finalBannerUrl = (body.bannerUrl || '').trim();
    }
    // 2. Если загружен файл через FormData
    else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const urlField = formData.get('bannerUrl') as string | null;

      if (urlField?.trim()) {
        finalBannerUrl = urlField.trim();
      } else if (file && file.size > 0) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        await mkdir(uploadDir, { recursive: true });

        const ext = path.extname(file.name) || '.jpg';
        const fileName = `banner-${user.id}-${Date.now()}${ext}`;
        const filePath = path.join(uploadDir, fileName);

        await writeFile(filePath, buffer);
        finalBannerUrl = `/uploads/${fileName}`;
      }
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