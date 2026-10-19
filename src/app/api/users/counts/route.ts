import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, safeJson } from '@/lib/current-user';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      return NextResponse.json({ watchingCount: 0, plannedCount: 0 });
    }

    // Считаем сколько тайтлов сейчас смотрится
    const watchingCount = await prisma.userShow.count({
      where: {
        userId: currentUserId,
        status: 'watching',
      },
    });

    // Считаем сколько тайтлов запланировано к просмотру
    const plannedCount = await prisma.userShow.count({
      where: {
        userId: currentUserId,
        status: 'planned',
      },
    });

    return NextResponse.json(
      safeJson({
        watchingCount,
        plannedCount,
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message, watchingCount: 0, plannedCount: 0 }, { status: 500 });
  }
}