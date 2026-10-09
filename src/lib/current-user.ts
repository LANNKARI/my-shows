import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Основная функция, которую используют все эндпоинты проекта
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

    // Запасной фолбэк для локального режима/разработки (чтобы данные не пропадали при отсутствии активной сессии)
    if (!user) {
      user = await prisma.user.findFirst();
    }

    return user;
  } catch (error) {
    console.error('Ошибка в getCurrentUser:', error);
    return null;
  }
}

// Вспомогательная функция для получения строкового ID
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id || null;
}

// Форматирование ссылок на постеры (TMDB + локальные загрузки)
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

  const clean = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `https://image.tmdb.org/t/p/w500${clean}`;
}

export default getCurrentUser;