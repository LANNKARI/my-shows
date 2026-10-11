import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, safeJson } from '@/lib/current-user';

export async function GET(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId();
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q') || searchParams.get('query') || '';

    // Очищаем запрос от пробелов и символа @ в начале
    const query = rawQuery.trim().replace(/^@+/, '');

    if (!query) {
      return NextResponse.json([]);
    }

    let users: {
      id: string;
      username: string;
      name: string | null;
      avatarUrl: string | null;
    }[] = [];

    try {
      users = await prisma.user.findMany({
        where: {
          AND: [
            currentUserId ? { id: { not: currentUserId } } : {},
            {
              OR: [
                { username: { contains: query, mode: 'insensitive' } },
                { name: { contains: query, mode: 'insensitive' } },
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
    } catch {
      // Фолбэк для баз данных без поддержки mode: 'insensitive'
      users = await prisma.user.findMany({
        where: {
          AND: [
            currentUserId ? { id: { not: currentUserId } } : {},
            {
              OR: [
                { username: { contains: query } },
                { name: { contains: query } },
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
    }

    // Определяем статус дружбы с найденными пользователями
    const userIds = users.map((u) => u.id);
    const relations =
      currentUserId && userIds.length > 0
        ? await prisma.friendship.findMany({
            where: {
              OR: [
                { requesterId: currentUserId, addresseeId: { in: userIds } },
                { requesterId: { in: userIds }, addresseeId: currentUserId },
              ],
            },
          })
        : [];

    const usersWithStatus = users.map((u) => {
      let friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends' = 'none';
      const rel = relations.find(
        (r) =>
          (r.requesterId === currentUserId && r.addresseeId === u.id) ||
          (r.requesterId === u.id && r.addresseeId === currentUserId)
      );

      if (rel) {
        if (rel.status === 'accepted') {
          friendshipStatus = 'friends';
        } else if (rel.requesterId === currentUserId) {
          friendshipStatus = 'pending_sent';
        } else {
          friendshipStatus = 'pending_received';
        }
      }

      return {
        ...u,
        friendshipStatus,
      };
    });

    return NextResponse.json(safeJson(usersWithStatus));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}