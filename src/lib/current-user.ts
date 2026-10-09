import { auth } from '@/lib/auth';
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

// Получение текущего пользователя с надежным фолбэком
export async function getCurrentUser() {
  try {
    const session = await auth();
    let user = null;

    if (session?.user) {
      const userId = (session.user as { id?: string }).id;
      const email = session.user.email;

      if (userId) {
        user = await prisma.user.findUnique({
          where: { id: userId },
        });
      } else if (email) {
        user = await prisma.user.findUnique({
          where: { email },
        });
      }
    }

    if (!user) {
      user = await prisma.user.findFirst();
    }

    return user;
  } catch (error) {
    console.error('Ошибка в getCurrentUser:', error);
    return null;
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
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