import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, safeJson } from '@/lib/current-user';

export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('query') || '';

    if (!query.trim()) {
      return NextResponse.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          currentUserId ? { id: { not: currentUserId } } : {},
          {
            OR: [
              { username: { contains: query.trim(), mode: 'insensitive' } },
              { name: { contains: query.trim(), mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatarUrl: true,
      },
      take: 10,
    });

    return NextResponse.json(safeJson(users));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}