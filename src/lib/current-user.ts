import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { mobileSession } from './mobile-session';
import { prisma } from '@/lib/prisma';

// Глобальный патч: автоматическая сериализация BigInt в обычное число
if (typeof BigInt !== 'undefined' && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return Number(this);
  };
}

// Универсальная очистка объектов от BigInt перед отправкой клиенту
export function safeJson<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}

// Отсутствующая или недействительная сессия никогда не даёт чужую личность.
export async function getCurrentUser() {
  try {
    const authorization = (await headers()).get('authorization');
    if (authorization !== null) {
      const mobile = await mobileSession(authorization);
      if (!mobile) return null;
      return prisma.user.findUnique({
        where: { id: mobile.userId },
        select: { id: true, email: true, username: true, name: true, bio: true, avatarUrl: true, bannerUrl: true, createdAt: true },
      });
    }
    const session = await auth();
    let user = null;

    if (session?.user) {
      const userId = (session.user as { id?: string }).id;
      const email = session.user.email;

      if (userId) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, username: true, name: true, bio: true, avatarUrl: true, bannerUrl: true, createdAt: true },
        });
      } else if (email) {
        user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, username: true, name: true, bio: true, avatarUrl: true, bannerUrl: true, createdAt: true },
        });
      }
    }

    return user;
  } catch (error) {
    console.error('Ошибка в getCurrentUser:', error);
    throw error;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const authorization = (await headers()).get('authorization');
  // An invalid explicit token must never fall back to a browser's identity.
  if (authorization !== null) return (await mobileSession(authorization))?.userId || null;
  const session = await auth();
  if (!session?.user) return null;
  // Verify account existence with a minimal query; database failures must propagate.
  const id = session.user.id;
  const email = session.user.email;
  if (!id && !email) return null;
  const user = await prisma.user.findUnique({
    where: id ? { id } : { email: email! },
    select: { id: true },
  });
  return user?.id || null;
}

// Корректное определение ссылок на постеры (TMDB + локальные загрузки)
export function formatPosterUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  // Если это имя файла из локальной папки загрузок
  if (
    trimmed.includes('-') &&
    (trimmed.endsWith('.jpg') || trimmed.endsWith('.png') || trimmed.endsWith('.webp')) &&
    !trimmed.startsWith('/')
  ) {
    return `/uploads/${trimmed}`;
  }

  const clean = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `https://image.tmdb.org/t/p/w500${clean}`;
}

export default getCurrentUser;
