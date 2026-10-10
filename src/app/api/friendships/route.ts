import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, safeJson } from '@/lib/current-user';

// GET: Получение списка подтвержденных друзей и заявок
export async function GET() {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Подтвержденные друзья (где пользователь либо отправитель, либо получатель)
    const acceptedFriendships = await prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: currentUserId }, { addresseeId: currentUserId }],
        status: 'accepted',
      },
      include: {
        requester: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
        addressee: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const friends = acceptedFriendships.map((f) =>
      f.requesterId === currentUserId ? f.addressee : f.requester
    );

    // Входящие заявки, ожидающие ответа
    const incomingRequests = await prisma.friendship.findMany({
      where: {
        addresseeId: currentUserId,
        status: 'pending',
      },
      include: {
        requester: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Исходящие заявки, отправленные текущим пользователем
    const outgoingRequests = await prisma.friendship.findMany({
      where: {
        requesterId: currentUserId,
        status: 'pending',
      },
      include: {
        addressee: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      safeJson({
        friends,
        incomingRequests: incomingRequests.map((r) => ({
          friendshipId: r.id,
          user: r.requester,
          createdAt: r.createdAt,
        })),
        outgoingRequests: outgoingRequests.map((r) => ({
          friendshipId: r.id,
          user: r.addressee,
          createdAt: r.createdAt,
        })),
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Отправка заявки или подтверждение входящей
export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { targetUserId, targetUsername, action = 'request' } = body;

    let targetUser = null;
    if (targetUserId) {
      targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    } else if (targetUsername) {
      targetUser = await prisma.user.findUnique({ where: { username: targetUsername } });
    }

    if (!targetUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    if (targetUser.id === currentUserId) {
      return NextResponse.json({ error: 'Нельзя добавить в друзья самого себя' }, { status: 400 });
    }

    // Проверяем существующие связи между пользователями
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: currentUserId, addresseeId: targetUser.id },
          { requesterId: targetUser.id, addresseeId: currentUserId },
        ],
      },
    });

    // 1. Принятие входящей заявки
    if (action === 'accept' && existing) {
      const updated = await prisma.friendship.update({
        where: { id: existing.id },
        data: { status: 'accepted' },
      });
      return NextResponse.json(safeJson({ success: true, status: 'friends', item: updated }));
    }

    // 2. Если дружба уже подтверждена
    if (existing?.status === 'accepted') {
      return NextResponse.json(safeJson({ success: true, status: 'friends' }));
    }

    // 3. Если встречная заявка уже ждет нашего подтверждения — сразу одобряем её
    if (existing && existing.addresseeId === currentUserId) {
      const updated = await prisma.friendship.update({
        where: { id: existing.id },
        data: { status: 'accepted' },
      });
      return NextResponse.json(safeJson({ success: true, status: 'friends', item: updated }));
    }

    // 4. Если запрос уже отправлен ранее
    if (existing && existing.requesterId === currentUserId) {
      return NextResponse.json(safeJson({ success: true, status: 'pending_sent' }));
    }

    // 5. Создаем новую заявку в друзья
    const created = await prisma.friendship.create({
      data: {
        requesterId: currentUserId,
        addresseeId: targetUser.id,
        status: 'pending',
      },
    });

    return NextResponse.json(safeJson({ success: true, status: 'pending_sent', item: created }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Отмена заявки или удаление из друзей
export async function DELETE(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');
    const targetUsername = searchParams.get('username');

    let targetUser = null;
    if (targetUserId) {
      targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    } else if (targetUsername) {
      targetUser = await prisma.user.findUnique({ where: { username: targetUsername } });
    }

    if (!targetUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: currentUserId, addresseeId: targetUser.id },
          { requesterId: targetUser.id, addresseeId: currentUserId },
        ],
      },
    });

    return NextResponse.json({ success: true, status: 'none' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}