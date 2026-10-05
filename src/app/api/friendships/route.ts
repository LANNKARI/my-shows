import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

// GET — список друзей и заявок
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const all = await prisma.friendship.findMany({
    where: {
      OR: [{ requesterId: me.id }, { addresseeId: me.id }],
    },
    include: {
      requester: { select: { id: true, username: true, name: true, avatarUrl: true } },
      addressee: { select: { id: true, username: true, name: true, avatarUrl: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const friends: any[] = [];
  const incoming: any[] = [];
  const outgoing: any[] = [];

  for (const f of all) {
    const other = f.requesterId === me.id ? f.addressee : f.requester;
    if (f.status === "accepted") {
      friends.push(other);
    } else if (f.status === "pending") {
      if (f.addresseeId === me.id) incoming.push({ ...other, friendshipId: f.id });
      else outgoing.push({ ...other, friendshipId: f.id });
    }
  }

  return NextResponse.json({ friends, incoming, outgoing });
}

// POST — отправить заявку в друзья
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { userId } = await req.json();
  if (!userId || userId === me.id) {
    return NextResponse.json({ error: "invalid user" }, { status: 400 });
  }

  // Проверяем, что пользователь существует
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  // Проверяем, что заявки ещё нет
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: me.id, addresseeId: userId },
        { requesterId: userId, addresseeId: me.id },
      ],
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Заявка уже существует или вы друзья" },
      { status: 409 }
    );
  }

  const friendship = await prisma.friendship.create({
    data: { requesterId: me.id, addresseeId: userId, status: "pending" },
  });

  return NextResponse.json(friendship, { status: 201 });
}

// PATCH — принять / отклонить / удалить
export async function PATCH(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { friendshipId, action } = await req.json();
  // action: "accept" | "reject" | "remove"

  const f = await prisma.friendship.findUnique({
    where: { id: Number(friendshipId) },
  });

  if (!f) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Права: только тот, к кому заявка, может принять/отклонить
  // Или любой из двух — удалить из друзей
  const isIncoming = f.addresseeId === me.id;
  const isParticipant = f.requesterId === me.id || f.addresseeId === me.id;

  if (action === "accept") {
    if (!isIncoming) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const updated = await prisma.friendship.update({
      where: { id: f.id },
      data: { status: "accepted" },
    });
    return NextResponse.json(updated);
  }

  if (action === "reject") {
    if (!isIncoming) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    await prisma.friendship.delete({ where: { id: f.id } });
    return NextResponse.json({ ok: true });
  }

  if (action === "remove") {
    if (!isParticipant) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    await prisma.friendship.delete({ where: { id: f.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}